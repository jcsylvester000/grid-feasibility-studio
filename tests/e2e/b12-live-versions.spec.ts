/**
 * Live Quick Report format and report versions: generate (version 1), edit an answer and run again
 * (version 2, dated today), view version 1 with its own inputs, download a version as JSON.
 * Server: VS_INPUT_QUICK_REPORT=fields against the mock, which answers in the live pipeline's format.
 */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { choose, fillQuickReport, goToStep, signUpAndStartQuick } from "./helpers";

test("versions: generate, edit and run again, view the older version and download it", async ({ page }) => {
  test.setTimeout(90_000);
  const id = await signUpAndStartQuick(page);
  await fillQuickReport(page);
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 25_000 });

  const view = page.getByTestId("report-view");
  await expect(view).toHaveAttribute("data-format", "live");
  await expect(page.getByTestId("verdict")).toContainText("Marginal");
  await expect(page.getByTestId("live-metrics")).toContainText("₱600,000,000");
  await expect(page.getByTestId("version-inputs")).toContainText("₱40,000 per sqm");
  await expect(page.getByTestId("version-line")).toContainText("Version 1 of 1");
  await expect(page.getByTestId("version-row")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Edit one answer and run again: a new version, the old one kept.
  await page.getByTestId("edit-and-rerun").click();
  await page.waitForURL(`**/app/new/quick_report?id=${id}`);
  await expect(page.getByTestId("new-version-note")).toContainText("version 2");
  await goToStep(page, /Price and comparables/);
  await choose(page, "Asking price per sqm", "₱60,000 per sqm");
  await goToStep(page, /Review/);
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 25_000 });
  await expect(page.getByTestId("verdict")).toContainText("Weak");
  await expect(page.getByTestId("version-line")).toContainText("Version 2 of 2");
  await expect(page.getByTestId("version-row")).toHaveCount(2);
  await expect(page.getByTestId("version-inputs")).toContainText("₱60,000 per sqm");

  // Version 1 is still there, with its own inputs.
  await page.getByTestId("view-version").first().click();
  await expect(page.getByText("You are viewing version 1 of 2")).toBeVisible();
  await expect(page.getByTestId("verdict")).toContainText("Marginal");
  await expect(page.getByTestId("version-inputs")).toContainText("₱40,000 per sqm");

  // Download a version as JSON: inputs entered, inputs sent, output.
  const runId = new URL(page.url()).searchParams.get("version")!;
  const res = await page.request.get(`/api/reports/${id}/versions/${runId}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("-v1.json");
  const body = await res.json();
  expect(body.version.number).toBe(1);
  expect(body.inputs.sent_to_pipeline.asking_price_per_sqm).toBe("₱40,000 per sqm");
  expect(body.output.body.format).toBe("vs_quick_report");

  // Another user cannot read it.
  const other = await page.context().browser()!.newContext();
  const res2 = await other.request.get(`http://localhost:${new URL(page.url()).port}/api/reports/${id}/versions/${runId}`);
  expect(res2.status()).toBe(401);
  await other.close();
});
