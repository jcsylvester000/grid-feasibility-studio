import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { fillPropertyAndUse, goToStep, signUpAndStart } from "./helpers";

const MOCK = "http://localhost:4010";
const PDF = path.join(process.cwd(), "tests/e2e/fixtures/title.pdf");
const pdf = (name: string, bytes: number) => ({ name, mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(Math.max(0, bytes - 9), 48)]) });
const origin = (page: Page) => ({ origin: new URL(page.url()).origin });

async function filesOf(page: Page, id: string) {
  const res = await page.request.get(`/api/reports/${id}/files`);
  return ((await res.json()) as { files: { id: string; name: string; docType: string | null }[] }).files;
}

test("AC-025: a 30 MB PDF is refused with the plain message and nothing is stored", async ({ page }) => {
  const id = await signUpAndStart(page, "Executive Summary");
  await goToStep(page, /^\d?\s*Documents/);
  await page.getByTestId("file-input").setInputFiles(pdf("big.pdf", 30 * 1024 * 1024));
  await expect(page.getByTestId("file-row").filter({ hasText: "big.pdf" })).toContainText("Files must be 25 MB or smaller");
  expect(await filesOf(page, id)).toHaveLength(0);
  // The server refuses it too, if the browser check is bypassed.
  const direct = await page.request.post("/api/dev-uploads", {
    headers: origin(page),
    multipart: { reportId: id, file: pdf("big.pdf", 30 * 1024 * 1024) },
  });
  expect([400, 413]).toContain(direct.status());
  expect(await filesOf(page, id)).toHaveLength(0);
});

test("AC-026: Generate stays disabled while a file is uploading, then the Executive Summary runs with the file", async ({ page }) => {
  const id = await signUpAndStart(page, "Executive Summary");
  await fillPropertyAndUse(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/dev-uploads", async (route) => {
    await gate;
    await route.continue();
  });
  await goToStep(page, /^\d?\s*Documents/);
  await page.getByTestId("file-input").setInputFiles(PDF);
  await expect(page.getByTestId("file-row")).toHaveAttribute("data-status", "uploading");
  await goToStep(page, /Review/);
  await expect(page.getByRole("button", { name: "Generate report" })).toBeDisabled();
  await expect(page.getByTestId("waiting-uploads")).toBeVisible();
  release();
  await expect(page.getByRole("button", { name: "Generate report" })).toBeEnabled();
  await goToStep(page, /^\d?\s*Documents/);
  await page.getByLabel("What is title.pdf?").selectOption({ value: "title_documents" });
  await expect.poll(async () => (await filesOf(page, id))[0]?.docType).toBe("title_documents");
  await goToStep(page, /Review/);
  await expect(page.getByTestId("summary-coverage")).toContainText("Financial projection");
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 25_000 });
  await expect(page.getByTestId("verdict")).toBeVisible();
  const log = (await (await page.request.get(`${MOCK}/__log?reportId=${id}`)).json()) as { entries: { files: string[]; documents: string[] }[] };
  expect(log.entries.at(-1)!.files[0]).toMatch(/^inputs\.file_1:title\.pdf:\d+$/);
  expect(log.entries.at(-1)!.documents).toEqual(["doc-1:title_documents"]);
});

test("Feasibility Report: lease fields by model, Next blocked until costs are complete, then it runs to Ready", async ({ page }) => {
  const id = await signUpAndStart(page, "Feasibility Report");
  await fillPropertyAndUse(page);
  await expect(page.getByTestId("fin-model")).toContainText("Develop and lease");
  await goToStep(page, /Owner or developer/);
  await page.getByLabel("Owner type").selectOption({ value: "family_corp" });
  await goToStep(page, /Costs and funding/);
  await page.getByLabel("I have cost and funding figures").check();
  await expect(page.getByLabel("Leasable area")).toBeVisible();
  await expect(page.getByLabel("Sellable area")).toHaveCount(0);
  await page.getByLabel("Land cost (total)").fill("601566000");
  await page.getByRole("button", { name: "Next" }).click({ force: true });
  await expect(page.getByRole("heading", { name: "Costs and funding" })).toBeVisible();
  await expect(page.getByTestId("costs-status")).toContainText("Still needed for L3");
  await expect(page.getByText("Enter leasable area.")).toBeVisible();

  await page.getByLabel("Development or build cost (total)").fill("212000000");
  await page.getByLabel("Leasable area").fill("8000");
  await page.getByLabel("Planned rent").fill("450");
  await page.getByLabel("Stabilised occupancy").selectOption({ value: "90" });
  await page.getByLabel("Construction period").selectOption({ value: "12" });
  await page.getByLabel("Funding split").selectOption({ value: "40" });
  await expect(page.getByTestId("costs-status")).toContainText("Complete");
  await goToStep(page, /Review/);
  await expect(page.getByTestId("report-coverage")).toContainText("A verdict is possible");
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 25_000 });
  await expect(page.getByTestId("report-view")).toHaveAttribute("data-product", "feasibility_report");
});

test("AC-033: deleting a report with two files removes them from storage", async ({ page }) => {
  const id = await signUpAndStart(page, "Executive Summary");
  await goToStep(page, /^\d?\s*Documents/);
  await page.getByTestId("file-input").setInputFiles([PDF, path.join(process.cwd(), "tests/e2e/fixtures/survey.pdf")]);
  await expect(page.locator('[data-testid=file-row][data-status=done]')).toHaveCount(2);
  const files = await filesOf(page, id);
  const urls = await Promise.all(files.map(async (f) => ((await (await page.request.get(`/api/files/${f.id}/url`)).json()) as { url: string }).url));
  for (const u of urls) expect((await page.request.get(u)).status()).toBe(200);

  const del = await page.request.delete(`/api/reports/${id}`, { headers: origin(page) });
  expect(del.ok()).toBe(true);
  for (const u of urls) expect((await page.request.get(u)).status()).toBe(404);
  expect((await page.request.get(`/api/files/${files[0]!.id}/url`)).status()).toBe(404);
});

test("Remove deletes one file; a signed link expires and cannot be forged", async ({ page }) => {
  const id = await signUpAndStart(page, "Feasibility Report");
  await goToStep(page, /^\d?\s*Documents/);
  await page.getByTestId("file-input").setInputFiles(PDF);
  await expect(page.locator('[data-testid=file-row][data-status=done]')).toHaveCount(1);
  const [f] = await filesOf(page, id);
  const { url } = (await (await page.request.get(`/api/files/${f!.id}/url`)).json()) as { url: string };
  expect((await page.request.get(url.replace(/s=[^&]+/, "s=forged"))).status()).toBe(403);
  await page.getByRole("button", { name: "Remove title.pdf" }).click();
  await expect(page.getByTestId("file-row")).toHaveCount(0);
  expect(await filesOf(page, id)).toHaveLength(0);
  expect((await page.request.get(url)).status()).toBe(404);
  await page.reload();
  await expect(page.getByTestId("file-row")).toHaveCount(0);
});

test("AC-034: deleting the account removes its stored files", async ({ page }) => {
  const id = await signUpAndStart(page, "Executive Summary");
  await goToStep(page, /^\d?\s*Documents/);
  await page.getByTestId("file-input").setInputFiles(PDF);
  await expect(page.locator('[data-testid=file-row][data-status=done]')).toHaveCount(1);
  const [f] = await filesOf(page, id);
  const { url } = (await (await page.request.get(`/api/files/${f!.id}/url`)).json()) as { url: string };
  await page.goto("/app/account");
  const label = (await page.getByText(/^Type your username \(/).textContent()) ?? "";
  await page.getByLabel(/Type your username/).fill(label.match(/\((.+?)\)/)![1]!);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  expect((await page.request.get(url)).status()).toBe(404);
});

test("the Feasibility Report form does not scroll sideways on any step", async ({ page }) => {
  await signUpAndStart(page, "Feasibility Report");
  await fillPropertyAndUse(page);
  for (const step of [/Format/, /Market evidence/, /Owner or developer/, /Costs and funding/, /Documents and site/, /Review/]) {
    await goToStep(page, step);
    if (/Costs/.test(String(step))) await page.getByLabel("I have cost and funding figures").check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});
