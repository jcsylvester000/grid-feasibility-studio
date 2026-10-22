import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { choose, freshAddress, register } from "./helpers";

const PNG = path.join(process.cwd(), "tests/e2e/fixtures/teaser.png");
const POST = "Good am po! Commercial lot along C6 Taguig, 1.4 has more or less, ₱42k/sqm. Call 0917 000 0000";

async function startScan(page: Page) {
  await freshAddress(page);
  await register(page);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  await page.getByRole("button", { name: "Start Teaser Scan" }).click();
  await page.waitForURL(/\/app\/new\/teaser_intake\?id=/);
  return new URL(page.url()).searchParams.get("id")!;
}

test("S-17: the scan needs a file or text, the relationship and the consent line", async ({ page }) => {
  await startScan(page);
  await page.getByRole("navigation", { name: "Form steps" }).getByRole("button", { name: /Review/ }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Still needed" });
  await expect(alert).toContainText("Upload a file or paste the post text.");
  await expect(alert).toContainText("Choose my relationship to this listing.");
  await expect(alert).toContainText("Tick the consent line to scan.");
  await expect(page.getByRole("button", { name: "Scan teaser" })).toBeDisabled();
});

test("Teaser Scan end to end: scan, resolve the conflict, confirm, and the Quick Report shows the Teaser check (TS-AC-02, TS-AC-09)", async ({ page }) => {
  const id = await startScan(page);
  await page.getByTestId("file-input").setInputFiles(PNG);
  await expect(page.locator("[data-testid=file-row][data-status=done]")).toHaveCount(1);
  await page.getByLabel("Pasted post text").fill(POST);
  await page.getByLabel("My relationship to this listing").selectOption({ value: "received_from_network" });
  await page.getByLabel(/I have the right to share/).check();
  await page.getByRole("navigation", { name: "Form steps" }).getByRole("button", { name: /Review/ }).click();
  await page.getByRole("button", { name: "Scan teaser" }).click();
  await page.waitForURL(`**/app/reports/${id}/confirm`, { timeout: 25_000 });

  // Conflict and missing comparables block Confirm.
  const confirm = page.getByRole("button", { name: "Confirm and run Quick Report" });
  await expect(page.getByTestId("conflicts")).toContainText("Conflict: Lot area");
  await expect(confirm).toBeDisabled();
  await expect(page.getByTestId("from-teaser").first()).toContainText("From teaser");
  await expect(page.getByTestId("seller-questions")).toContainText("certified true copy");
  await expect(page.getByText("0917")).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  await page.getByLabel("14,323 sqm").check();
  await expect(page.getByTestId("confirm-blocked")).toContainText("Answer the required fields");
  await choose(page, "Comparable listings, lowest", "₱30,000 per sqm");
  await choose(page, "Comparable listings, highest", "₱50,000 per sqm");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.waitForURL(/\/app\/reports\/[0-9a-f-]+\/run$/);
  expect(page.url()).not.toContain(id);
  await page.waitForURL(/\/app\/reports\/[0-9a-f-]+$/, { timeout: 25_000 });
  await expect(page.getByTestId("report-view")).toHaveAttribute("data-product", "quick_report");
  await expect(page.getByTestId("teaser-check")).toContainText("Clean title");

  // The scan itself now links to the Quick Report.
  await page.goto(`/app/reports/${id}`);
  await expect(page.getByRole("link", { name: "Open the Quick Report made from this teaser" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("Discard deletes the scan", async ({ page }) => {
  const id = await startScan(page);
  await page.getByLabel("Pasted post text").fill(POST);
  await page.getByLabel("My relationship to this listing").selectOption({ value: "owner_direct" });
  await page.getByLabel(/I have the right to share/).check();
  await page.getByRole("navigation", { name: "Form steps" }).getByRole("button", { name: /Review/ }).click();
  await page.getByRole("button", { name: "Scan teaser" }).click();
  await page.waitForURL(`**/app/reports/${id}/confirm`, { timeout: 25_000 });
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Discard scan" }).click();
  await page.waitForURL("**/app/reports");
  expect((await page.goto(`/app/reports/${id}/confirm`))?.status()).toBe(404);
});
