import { expect, test } from "@playwright/test";
import { freshAddress, register } from "./helpers";

test("AC-003 / B7-05: with the flag off the Teaser Scan is hidden everywhere", async ({ page }) => {
  await freshAddress(page);
  await register(page);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  await expect(page.getByRole("button", { name: "Start Teaser Scan" })).toHaveCount(0);
  expect((await page.goto("/app/new/teaser_intake"))?.status()).toBe(404);
  const products = (await (await page.request.get("/api/products")).json()) as { products: { key: string }[] };
  expect(products.products.map((p) => p.key)).not.toContain("teaser_intake");
  const r = await page.request.post("/api/teasers/00000000-0000-4000-8000-000000000000/confirm", { headers: { origin: new URL(page.url()).origin }, data: {} });
  expect(r.status()).toBe(404);
});
