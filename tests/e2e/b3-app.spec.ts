import { expect, test, type Page } from "@playwright/test";
import { freshAddress, login, PASSWORD, register } from "./helpers";

async function signUp(page: Page) {
  await freshAddress(page);
  const name = await register(page);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  return name;
}

async function start(page: Page, productName: string) {
  await page.goto("/app");
  await page.getByRole("button", { name: `Start ${productName}` }).click();
  await page.waitForURL(/\/app\/new\/\w+\?id=/);
  return new URL(page.url()).searchParams.get("id")!;
}

test("dashboard shows products with estimated typical times and an empty state", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("heading", { name: "Start a report" })).toBeVisible();
  for (const n of ["Quick Report", "Executive Summary", "Feasibility Report"])
    await expect(page.getByRole("heading", { name: n, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Teaser Scan" })).toHaveCount(0);
  await expect(page.getByText("(estimate)").first()).toBeVisible(); // AC-021
  await expect(page.getByText("No reports yet")).toBeVisible();
});

test("AC-022: choosing Quick Report creates a draft and opens its form", async ({ page }) => {
  await signUp(page);
  const id = await start(page, "Quick Report");
  await expect(page.getByTestId("report-form")).toHaveAttribute("data-report-id", id);
  await expect(page.getByTestId("report-form").getByText("Draft", { exact: true })).toBeVisible();
});

test("AC-019 and AC-020: users see only their own reports, newest first; other ids 404 (AC-031)", async ({ page, browser }) => {
  await signUp(page);
  await start(page, "Quick Report");
  await start(page, "Executive Summary");
  const newest = await start(page, "Feasibility Report");
  await page.goto("/app");
  const rows = page.getByTestId("report-list").getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Feasibility Report");

  const other = await browser.newPage();
  await signUp(other);
  await other.goto("/app/reports");
  await expect(other.getByText("No reports yet")).toBeVisible();
  const res = await other.goto(`/app/reports/${newest}`);
  expect(res?.status()).toBe(404);
  const api = await other.request.get(`/api/reports/${newest}`);
  expect(api.status()).toBe(404);
  await other.close();
});

test("My reports: filters live in the URL; delete asks for confirmation", async ({ page }) => {
  await signUp(page);
  await start(page, "Quick Report");
  await start(page, "Executive Summary");
  await page.goto("/app/reports");
  await page.getByLabel("Product").selectOption("quick_report");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/product=quick_report/);
  const table = page.getByTestId("reports-table");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.reload();
  await expect(table.locator("tbody tr")).toHaveCount(1);

  await table.locator("summary", { hasText: "Delete" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByText("The report was deleted.")).toBeVisible();
  await expect(page).toHaveURL(/product=quick_report/);
  await expect(page.getByText("No reports match")).toBeVisible();
});

test("API: create, autosave and delete a report; cross-origin writes are refused", async ({ page }) => {
  await signUp(page);
  const origin = new URL(page.url()).origin;
  const create = await page.request.post("/api/reports", { data: { product: "quick_report" }, headers: { origin } });
  expect(create.status()).toBe(201);
  const { id } = await create.json();
  const patch = await page.request.patch(`/api/reports/${id}`, { data: { intake: { "qd.lot_area": 15000 } }, headers: { origin } });
  expect(patch.ok()).toBe(true);
  const read = await (await page.request.get(`/api/reports/${id}`)).json();
  expect(read.report.intake).toEqual({ "qd.lot_area": 15000 });
  const evil = await page.request.patch(`/api/reports/${id}`, { data: { title: "x" }, headers: { origin: "https://evil.example" } });
  expect(evil.status()).toBe(403);
  expect((await page.request.delete(`/api/reports/${id}`, { headers: { origin } })).status()).toBe(204);
  const opts = await (await page.request.get("/api/options?product=quick_report")).json();
  expect(opts.fields.length).toBeGreaterThan(10);
  expect(opts.locations.NCR["Metro Manila"]).toContain("Taguig");
});

test("New report helper suggests a product", async ({ page }) => {
  await signUp(page);
  await page.goto("/app/new");
  await page.getByRole("group", { name: "Do you need a full study?" }).getByText("Yes").click();
  await expect(page.locator('[data-product="feasibility_report"]')).toContainText("Suggested");
  await page.getByRole("group", { name: "Do you need a full study?" }).getByText("No").click();
  await page.getByRole("group", { name: "Do you have cost and funding figures?" }).getByText("No").click();
  await expect(page.locator('[data-product="quick_report"]')).toContainText("Suggested");
});

test("Account: User ID shown; change password signs other devices out", async ({ page, browser }) => {
  const name = await signUp(page);
  const second = await browser.newPage();
  await freshAddress(second);
  await login(second, name);
  await second.waitForURL("**/app");

  await page.goto("/app/account");
  await expect(page.getByTestId("account-public-id")).toHaveText(/^U-/);
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill("copper lantern meadow five");
  await page.getByLabel("Confirm new password").fill("copper lantern meadow five");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  await second.goto("/app/reports");
  await expect(second).toHaveURL(/\/login/);
  await second.close();
});

test("AC-035: log out of all devices ends both sessions", async ({ page, browser }) => {
  const name = await signUp(page);
  const second = await browser.newPage();
  await freshAddress(second);
  await login(second, name);
  await second.waitForURL("**/app");
  await page.goto("/app/account");
  await page.getByRole("button", { name: "Log out of all devices" }).click();
  await page.waitForURL("**/login");
  await second.goto("/app");
  await expect(second).toHaveURL(/\/login/);
  await second.close();
});

test("AC-034: delete account requires the username and then signs out for good", async ({ page }) => {
  const name = await signUp(page);
  await page.goto("/app/account");
  await page.getByLabel(/Type your username/).fill("wrong-name");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Type your username exactly to confirm.")).toBeVisible();
  await page.getByLabel(/Type your username/).fill(name);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await freshAddress(page);
  await login(page, name);
  await expect(page.locator("form [role=alert]")).toHaveText("That username and password do not match.");
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test("bottom navigation works and nothing scrolls sideways", async ({ page }) => {
    await signUp(page);
    const bottom = page.getByRole("navigation", { name: "App" }).last();
    await bottom.getByRole("link", { name: "My reports" }).click();
    await expect(page).toHaveURL(/\/app\/reports/);
    for (const path of ["/app", "/app/new", "/app/reports", "/app/account"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    }
  });
});
