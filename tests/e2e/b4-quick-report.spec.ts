import { expect, test } from "@playwright/test";
import { choose, fillQuickReport, signUpAndStartQuick } from "./helpers";

const MOCK = "http://localhost:4010";

test("AC-023: the Quick Report form has no free-text or number inputs (and fits the screen)", async ({ page }) => {
  await signUpAndStartQuick(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const form = page.getByTestId("report-form-client");
  for (const step of ["Property", "Client and papers", "Price and comparables"]) {
    await form.getByRole("navigation", { name: "Form steps" }).getByRole("button", { name: new RegExp(step) }).click();
    await expect(form.locator('input:not([type="hidden"]), textarea')).toHaveCount(0);
    expect(await form.locator("select").count()).toBeGreaterThan(0);
  }
});

test("AC-024: Review lists missing required fields with Edit links and Generate is disabled", async ({ page }) => {
  await signUpAndStartQuick(page);
  await page.getByRole("navigation", { name: "Form steps" }).getByRole("button", { name: /Review/ }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Still needed" });
  await expect(alert).toContainText("Choose asking price per sqm.");
  await expect(page.getByRole("button", { name: "Generate report" })).toBeDisabled();
  await alert.getByRole("button", { name: /Edit Asking price/ }).click();
  await expect(page.getByRole("heading", { name: "Price and comparables" })).toBeVisible();
});

test("cascading location, hidden rent without a building, high-below-low error, autosave survives reload", async ({ page }) => {
  await signUpAndStartQuick(page);
  await expect(page.getByLabel("Province")).toBeDisabled();
  await choose(page, "Region", "CALABARZON (Region IV-A)");
  await choose(page, "Province", "Cavite");
  await expect(page.getByLabel("City or municipality").locator("option")).toContainText(["Bacoor"]);
  await choose(page, "City or municipality", "Bacoor");
  await expect(page.getByTestId("save-state")).toHaveText("Saved");

  await page.getByRole("navigation", { name: "Form steps" }).getByRole("button", { name: /Price and comparables/ }).click();
  await expect(page.getByLabel("Current or asking rent")).toHaveCount(0);
  await choose(page, "Comparable listings, lowest", "₱50,000 per sqm");
  await choose(page, "Comparable listings, highest", "₱30,000 per sqm");
  await expect(page.getByText("The highest comparable must be the same as or more than the lowest.")).toBeVisible();

  await page.getByRole("navigation", { name: "Form steps" }).getByRole("button", { name: /Property/ }).click();
  await choose(page, "Building on site", "about 500 sqm of building");
  await page.getByRole("navigation", { name: "Form steps" }).getByRole("button", { name: /Price and comparables/ }).click();
  await expect(page.getByLabel("Current or asking rent")).toBeVisible();
  await expect(page.getByTestId("save-state")).toHaveText("Saved");

  await page.reload();
  await expect(page.getByLabel("City or municipality")).toHaveValue("Bacoor");
});

test("AC-029: Generate runs the pipeline (mock) and the report opens when ready", async ({ page }) => {
  const id = await signUpAndStartQuick(page);
  await fillQuickReport(page);
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${id}/run`);
  await expect(page.getByTestId("run-headline")).toHaveText(/being prepared|free slot/);
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 20_000 });
  await expect(page.getByTestId("verdict")).toContainText("Marginal");
  await page.goto("/app/reports");
  await expect(page.getByTestId("reports-table")).toContainText("Ready");
});

test("AC-028: a SCHEMA_INVALID run shows the plain message and Retry, and no report content", async ({ page, request }) => {
  const id = await signUpAndStartQuick(page);
  await request.post(`${MOCK}/__control/${id}`, { data: { scenario: "schema_invalid" } });
  await fillQuickReport(page);
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByTestId("run-headline")).toHaveText("The report could not be generated", { timeout: 20_000 });
  await expect(page.getByTestId("run-message")).toContainText("SCHEMA_INVALID");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByText("Marginal")).toHaveCount(0);

  await request.delete(`${MOCK}/__control/${id}`);
  await page.getByRole("button", { name: "Retry" }).click();
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 20_000 });
  await expect(page.getByTestId("verdict")).toContainText("Marginal");
});

test("AC-027: leaving and coming back shows the same run without starting a new one; Cancel works", async ({ page, request }) => {
  const id = await signUpAndStartQuick(page);
  await request.post(`${MOCK}/__control/${id}`, { data: { scenario: "slow" } });
  await fillQuickReport(page);
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${id}/run`);
  await page.goto("/app");
  await expect(page.getByTestId("report-list")).toContainText(/Queued|Running/);
  await page.getByTestId("report-list").getByRole("link").first().click();
  await page.waitForURL(`**/app/reports/${id}/run`);
  await expect(page.getByTestId("run-headline")).toHaveText(/being prepared|free slot/);
  const generateAgain = await page.request.post(`/api/reports/${id}/runs`, { headers: { origin: new URL(page.url()).origin } });
  expect(generateAgain.status()).toBe(409);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("run-headline")).toHaveText("Cancelled");
  await page.getByRole("link", { name: "Start again" }).click();
  await page.waitForURL(`**/app/new/quick_report?id=${id}`);
  await request.delete(`${MOCK}/__control/${id}`);
});
