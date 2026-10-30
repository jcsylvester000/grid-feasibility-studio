/**
 * Report chaining: a finished Quick Report starts an Executive Summary with its answers carried over;
 * the form opens on the first step that still needs an answer; approximate values say so; the run
 * receives the source link and the research-reuse flag; the Executive Summary then starts a
 * Feasibility Report the same way, and the dashboard's Start offers the finished reports first.
 */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fillQuickReport, goToStep, signUpAndStartQuick } from "./helpers";

const MOCK = "http://localhost:4010";

test("Quick Report → Executive Summary → Feasibility Report with only the new answers", async ({ page }) => {
  test.setTimeout(120_000);
  const qrId = await signUpAndStartQuick(page);
  await fillQuickReport(page);
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${qrId}`, { timeout: 25_000 });

  // Upgrade from the finished Quick Report.
  await expect(page.getByTestId("upgrade-panel")).toBeVisible();
  await page.getByTestId("upgrade-executive_summary").click();
  await page.waitForURL(/\/app\/new\/executive_summary\?id=/);
  const esId = new URL(page.url()).searchParams.get("id")!;
  await expect(page.getByTestId("source-banner")).toContainText("Started from your Quick Report");
  await expect(page.getByTestId("source-banner")).toContainText("will be reused");
  // Opens on "Use and goals": the intended use is the one new required answer.
  await expect(page.getByRole("heading", { name: "Use and goals", level: 2 })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByLabel("Intended use").selectOption({ value: "residential_condominium" });

  // Carried answers are filled in; band values are marked approximate and can be replaced.
  await goToStep(page, /^\d?\s*Property/);
  await expect(page.getByLabel("City or municipality")).toHaveValue("Taguig");
  await expect(page.getByLabel("Lot area")).toHaveValue("15000");
  await expect(page.getByText("From your Quick Report (approximate)").first()).toBeVisible();
  await page.getByLabel("Lot area").fill("15234");
  await goToStep(page, /Headline costs/);
  await expect(page.getByLabel("Land cost (total)")).toHaveValue("600000000");
  await expect(page.getByText("asking price × lot area (approximate)")).toBeVisible();

  await goToStep(page, /Review/);
  await expect(page.getByTestId("save-state")).toHaveText("Saved", { timeout: 10_000 });
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${esId}`, { timeout: 25_000 });
  const log = (await (await page.request.get(`${MOCK}/__log?reportId=${esId}`)).json()) as { entries: { source?: Record<string, unknown> }[] };
  expect(log.entries.at(-1)!.source).toMatchObject({ "source.report_id": qrId, "source.product": "quick_report", "source.reuse_research": true });

  // Executive Summary → Feasibility Report.
  await page.getByTestId("upgrade-feasibility_report").click();
  await page.waitForURL(/\/app\/new\/feasibility_report\?id=/);
  await expect(page.getByTestId("source-banner")).toContainText("Started from your Executive Summary");
  await goToStep(page, /^\d?\s*Property/);
  await expect(page.getByLabel("Lot area")).toHaveValue("15234"); // the exact figure carried, not the band
  await goToStep(page, /Use and goals/);
  await expect(page.getByLabel("Intended use")).toHaveValue("residential_condominium");

  // Starting from the dashboard now offers the finished reports first.
  await page.goto("/app");
  await page.getByRole("button", { name: "Start Feasibility Report" }).click();
  await page.waitForURL("**/app/new/feasibility_report/start");
  await expect(page.getByTestId("source-option")).toHaveCount(2);
  await expect(page.getByTestId("source-option").first()).toContainText("Executive Summary");
  await page.getByRole("button", { name: "Start blank" }).click();
  await page.waitForURL(/\/app\/new\/feasibility_report\?id=/);
  await expect(page.getByTestId("source-banner")).toHaveCount(0);
});
