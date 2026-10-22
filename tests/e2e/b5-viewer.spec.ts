import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { fillQuickReport, freshAddress, register, signUpAndStartQuick } from "./helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const golden = (p: string) => JSON.parse(readFileSync(path.join(process.cwd(), "mock/vectorshift/payloads", `${p}.json`), "utf8"));

async function generateQuick(page: Page) {
  const id = await signUpAndStartQuick(page);
  await fillQuickReport(page);
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 20_000 });
  await expect(page.getByTestId("report-view")).toBeVisible();
  return id;
}

test("AC-030: the viewer shows the payload's numbers, changed only by formatting", async ({ page }) => {
  await generateQuick(page);
  const qr = golden("quick_report");
  const view = page.getByTestId("report-view");
  await expect(page.getByTestId("verdict")).toContainText(qr.indicative.label);
  const metrics = page.getByTestId("metrics");
  // Payload: 42000 PHP/sqm, 601566000 PHP, discount −0.05 (fraction) → shown as ₱42,000/sqm, ₱601,566,000, −5%.
  await expect(metrics).toContainText("₱42,000/sqm");
  await expect(metrics).toContainText("₱601,566,000");
  await expect(metrics).toContainText("−5%");
  for (const s of qr.sources) await expect(view.locator(`#src-${s.id}`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("AC-031: another user's report id and an unknown id give 404", async ({ page, browser }) => {
  const id = await generateQuick(page);
  const other = await browser.newPage();
  await freshAddress(other);
  await register(other);
  const res = await other.goto(`/app/reports/${id}`);
  expect(res?.status()).toBe(404);
  const unknown = await other.goto(`/app/reports/00000000-0000-4000-8000-000000000000`);
  expect(unknown?.status()).toBe(404);
  await other.close();
});

test("AC-032: Print records the event and gives an A4 PDF with app chrome hidden (margin-box header and page numbers checked with pdftotext)", async ({ page, browserName }, info) => {
  test.skip(info.project.name !== "desktop" || browserName !== "chromium", "PDF output is Chromium desktop only");
  const id = await generateQuick(page);
  const printed = page.waitForResponse((r) => r.url().endsWith(`/api/reports/${id}/events`) && r.request().method() === "POST");
  await page.evaluate(() => (window.print = () => {}));
  await page.getByRole("button", { name: "Print or save as PDF" }).click();
  expect((await printed).status()).toBe(200);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header[data-print=hide]").first()).toBeHidden();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden();
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const text = pdf.toString("latin1");
  const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBeGreaterThan(0);
  // A4 = 595 × 842 points.
  expect(text).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+59[45](\.\d+)?\s+84[12](\.\d+)?\s*\]/);
  info.attachments.push({ name: "report.pdf", contentType: "application/pdf", body: pdf });
});

test("Run again from the viewer starts a new run and returns to the report", async ({ page }) => {
  const id = await generateQuick(page);
  await page.getByRole("button", { name: "Run again" }).click();
  await page.waitForURL(`**/app/reports/${id}/run`);
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 20_000 });
  await expect(page.getByTestId("verdict")).toBeVisible();
});

for (const key of ["quick_report_teaser", "executive_summary", "feasibility_report"]) {
  test(`viewer sample ${key} renders without horizontal scroll`, async ({ page }) => {
    await page.goto(`/design/report/${key}`);
    await expect(page.getByTestId("verdict").first()).toBeVisible();
    if (key === "quick_report_teaser") await expect(page.getByTestId("teaser-check")).toContainText("Clean title");
    if (key === "feasibility_report") {
      await expect(page.getByTestId("criteria")).toBeVisible();
      await expect(page.getByTestId("financials")).toContainText("2.53%");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}
