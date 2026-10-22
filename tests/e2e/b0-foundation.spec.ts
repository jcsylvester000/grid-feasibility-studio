import { expect, test } from "@playwright/test";

test("home placeholder renders with the GRID logo and no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("feasibility reports");
  await expect(page.getByAltText("GRID Property Ventures")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("design board shows tokens and the shortlist", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("heading", { name: "Palette" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Component shortlist/ })).toBeVisible();
});

test("fonts are self-hosted (no requests to external font hosts)", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(external).toEqual([]);
});

test("health check reports the database state without leaking secrets", async ({ request }) => {
  const res = await request.get("/api/health");
  const body = await res.json();
  expect(["ok", "not_configured", "error"]).toContain(body.database);
  expect(JSON.stringify(body)).not.toMatch(/postgres(ql)?:\/\//);
});
