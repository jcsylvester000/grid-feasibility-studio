import { expect, test, type Browser, type Page } from "@playwright/test";
import { fillQuickReport, freshAddress, login, signUpAndStartQuick, uniqueName, register } from "./helpers";

const MOCK = "http://localhost:4010";

async function asAdmin(browser: Browser) {
  const page = await browser.newPage();
  await freshAddress(page);
  await login(page, "e2e_admin", "admin pass phrase for tests");
  await page.waitForURL("**/admin");
  return page;
}

async function userId(page: Page) {
  await page.goto("/app/account");
  return (await page.getByTestId("account-public-id").textContent())!.trim();
}

test("AD-01: the overview shows tiles, charts and top User IDs; the period picker works", async ({ browser }) => {
  const admin = await asAdmin(browser);
  await expect(admin.getByTestId("tile-registered")).toBeVisible();
  await expect(admin.getByTestId("tile-runs")).toBeVisible();
  await admin.getByRole("link", { name: "7 days" }).click();
  await expect(admin).toHaveURL(/range=7d/);
  await expect(admin.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "true");
  expect(await admin.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("AC-040: a suspended user is signed out on their next page and sees the suspended message", async ({ page, browser }) => {
  const name = await register(page);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  const id = await userId(page);

  const admin = await asAdmin(browser);
  await admin.goto("/admin/users");
  await admin.getByLabel("User ID").fill(id);
  await admin.getByRole("button", { name: "Apply" }).first().click();
  await admin.getByRole("link", { name: id }).click();
  admin.once("dialog", (d) => void d.accept());
  await admin.getByRole("button", { name: "Suspend" }).click();
  await expect(admin.getByTestId("suspended-banner")).toBeVisible();

  await page.goto("/app/reports");
  await page.waitForURL(/\/login\?.*ended=1/);
  await expect(page.getByTestId("session-ended")).toContainText("suspended");
  await freshAddress(page);
  await login(page, name);
  await expect(page.locator("form [role=alert]")).toContainText("This account is suspended");

  admin.once("dialog", (d) => void d.accept());
  await admin.getByRole("button", { name: "Reactivate" }).click();
  await expect(admin.getByTestId("suspended-banner")).toHaveCount(0);
});

test("AC-041 (UI): a reset code is shown once", async ({ page, browser }) => {
  await register(page);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  const id = await userId(page);
  const admin = await asAdmin(browser);
  await admin.goto(`/admin/users/${id}`);
  admin.once("dialog", (d) => void d.accept());
  await admin.getByRole("button", { name: "Issue reset code" }).click();
  await expect(admin.getByTestId("reset-code")).toContainText(/[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/);
  await admin.reload();
  await expect(admin.getByTestId("reset-code")).toHaveCount(0);
});

test("AC-042: a failed run's panel shows the error code and VectorShift run id and no report content", async ({ page, browser, request }) => {
  const reportId = await signUpAndStartQuick(page);
  await request.post(`${MOCK}/__control/${reportId}`, { data: { scenario: "failed" } });
  await fillQuickReport(page);
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByTestId("run-headline")).toHaveText("The report could not be generated", { timeout: 20_000 });
  await request.delete(`${MOCK}/__control/${reportId}`);
  const title = (await page.locator("h1").first().textContent()) ?? "";

  const admin = await asAdmin(browser);
  await admin.goto("/admin/runs?status=failed");
  const row = admin.getByTestId("runs-table").locator("tr", { hasText: "VS_FAILED" }).first();
  await row.getByRole("link").first().click();
  const panel = admin.getByTestId("run-panel");
  await expect(panel).toContainText("VS_FAILED");
  await expect(panel).toContainText(/mockrun_/);
  if (title.trim()) await expect(panel).not.toContainText(title.trim());
});

test("AC-037: admin pages, APIs and CSVs never show a username", async ({ page, browser }) => {
  const name = uniqueName("privacy");
  await freshAddress(page);
  await register(page, name);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  const id = await userId(page);
  const admin = await asAdmin(browser);
  const urls = [
    "/admin", "/admin/users", `/admin/users/${id}`, "/admin/runs", "/admin/pipelines",
    "/api/admin/usage/summary", "/api/admin/usage/timeseries", "/api/admin/users", `/api/admin/users/${id}`, "/api/admin/runs", "/api/admin/pipelines",
    "/api/admin/export.csv?view=users", "/api/admin/export.csv?view=runs", "/api/admin/export.csv?view=daily",
  ];
  for (const u of urls) {
    const res = await admin.request.get(u);
    expect(res.status(), u).toBe(200);
    const body = (await res.text()).toLowerCase();
    expect(body, u).not.toContain(name.toLowerCase());
    expect(body, u).not.toContain("e2e_admin");
  }
  const csv = await admin.request.get("/api/admin/export.csv?view=users");
  expect((await csv.text()).split("\r\n")[0]).not.toMatch(/username/);
  // Non-admins get 404 from the admin API.
  expect((await page.request.get("/api/admin/users")).status()).toBe(404);
});
