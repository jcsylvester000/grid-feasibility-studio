/**
 * GRID Token wallet (mock). Live server: tokens on, opening balance 60, demo mode (top-up).
 * Ask before using tokens; cancel uses nothing; 60 → 30 → 0; at 0 the Quick Report is greyed out
 * everywhere; the wallet lists the activity; no peso value is ever shown for tokens.
 */
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fillQuickReport, goToStep, signUpAndStartQuick } from "./helpers";

test("asks before using tokens, charges 30 per Quick Report and greys it out when the wallet is low", async ({ page }) => {
  test.setTimeout(90_000);
  const id = await signUpAndStartQuick(page);
  await expect(page.getByTestId("token-chip")).toHaveText(/^60(?!\d)/);
  await fillQuickReport(page);
  await expect(page.getByTestId("generate-token-cost")).toContainText("Uses 30 GRID Tokens");

  // Cancel: nothing is used, nothing starts.
  await page.getByRole("button", { name: "Generate report" }).click();
  const dialog = page.getByTestId("token-confirm");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Use 30 GRID Tokens?");
  await expect(page.getByTestId("token-balance-after")).toHaveText("30");
  await expect(dialog).not.toContainText(/₱|php|peso/i);
  const axe = await new AxeBuilder({ page }).include("[data-testid=token-confirm]").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/app/new/quick_report\\?id=${id}`));

  // Confirm: 60 → 30.
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.getByTestId("token-confirm-ok").click();
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 25_000 });
  await expect(page.getByTestId("token-chip")).toHaveText(/^30(?!\d)/);
  // Back goes to the dashboard, not to the form or the progress page.
  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);
  await page.goForward();
  await page.waitForURL(`**/app/reports/${id}`);

  // Run again: asks, then 30 → 0.
  await page.getByTestId("run-again").click();
  await expect(page.getByTestId("token-balance-after")).toHaveText("0");
  await page.getByTestId("token-confirm-ok").click();
  await page.waitForURL(`**/app/reports/${id}/run`, { timeout: 10_000 });
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 25_000 });
  await expect(page.getByTestId("token-chip")).toHaveText(/^0(?!\d)/);
  await expect(page.getByTestId("run-again")).toBeDisabled();

  // Dashboard: the Quick Report card is greyed out and cannot start.
  await page.goto("/app");
  const card = page.locator('form[data-product="quick_report"]');
  await expect(card).toHaveAttribute("data-blocked", "true");
  await expect(card).toContainText("Not enough GRID Tokens");
  await expect(card.getByRole("button", { name: "Start Quick Report" })).toBeDisabled();

  // Wallet: balance, activity, no cash value.
  await page.goto("/app/account#tokens");
  await expect(page.getByTestId("wallet-balance")).toHaveText(/^0(?!\d)/);
  const activity = page.getByTestId("wallet-activity");
  await expect(activity).toContainText("Opening balance");
  await expect(activity.getByText("Report generated")).toHaveCount(2);
  await expect(page.locator("#tokens")).not.toContainText(/₱|php|peso/i);

  // Demo top-up brings the Quick Report back.
  await page.getByTestId("token-top-up").click();
  await expect(page.getByTestId("wallet-balance")).toContainText("300");
  await page.goto("/app");
  await expect(page.locator('form[data-product="quick_report"]')).not.toHaveAttribute("data-blocked", "true");
});

test("the API refuses a start without enough tokens, and the form cannot generate", async ({ page }) => {
  test.setTimeout(90_000);
  const id = await signUpAndStartQuick(page);
  await fillQuickReport(page);
  await expect(page.getByTestId("save-state")).toHaveText("Saved", { timeout: 10_000 });
  for (let i = 0; i < 2; i++) {
    const r = await page.request.post(`/api/reports/${id}/runs`, { headers: { origin: new URL(page.url()).origin } });
    expect(r.status()).toBe(202);
    await expect.poll(async () => (await (await page.request.get(`/api/reports/${id}`)).json()).report?.status ?? "", { timeout: 20_000 }).not.toMatch(/queued|running/);
  }
  const r = await page.request.post(`/api/reports/${id}/runs`, { headers: { origin: new URL(page.url()).origin } });
  expect(r.status()).toBe(402);
  const body = await r.json();
  expect(body.error.code).toBe("INSUFFICIENT_TOKENS");
  expect(body.error.message).not.toMatch(/₱|php|peso/i);

  // The form shows why and keeps Generate disabled.
  await page.goto(`/app/new/quick_report?id=${id}`);
  await goToStep(page, /Review/);
  await expect(page.getByTestId("not-enough-tokens")).toContainText("Not enough GRID Tokens");
  await expect(page.getByRole("button", { name: "Generate report" })).toBeDisabled();
});
