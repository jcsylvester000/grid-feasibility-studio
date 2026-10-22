/** Demo scenarios (prototype): load the 20 reports from the dashboard and open them. Runs on the server with DEMO_MODE on. */
import { expect, test } from "@playwright/test";
import { freshAddress, register } from "./helpers";

test("load the 20 demo scenarios and open a Quick Report and a Feasibility Report", async ({ page }) => {
  test.setTimeout(90_000);
  await freshAddress(page);
  await register(page);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  await expect(page.getByTestId("prototype-banner")).toBeVisible();
  await page.getByRole("button", { name: "Load the 20 demo scenarios" }).click();
  await expect(page.getByTestId("demo-loader")).toContainText("20 of 20 demo scenarios", { timeout: 30_000 });

  await page.goto("/app/reports?q=Demo%2016");
  await page.getByRole("link", { name: /Demo 16/ }).first().click();
  await expect(page.getByTestId("prototype-notice")).toBeVisible();
  await expect(page.getByTestId("verdict").first()).toContainText("Feasible");

  await page.goto("/app/reports?q=Demo%2003");
  await page.getByRole("link", { name: /Demo 03/ }).first().click();
  await expect(page.getByTestId("verdict")).toContainText("Weak");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
