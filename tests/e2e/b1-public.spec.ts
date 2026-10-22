import { expect, test } from "@playwright/test";

const pages = ["/", "/feasibility-study", "/how-it-works", "/terms", "/privacy"];

test.describe("public pages", () => {
  for (const path of pages) {
    test(`${path} renders with header, footer and no horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("AC-003: no Teaser Scan card when the flag is off", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Quick Report", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teaser Scan" })).toHaveCount(0);
    await page.goto("/feasibility-study");
    await expect(page.getByRole("table")).not.toContainText("Teaser Scan");
  });

  test("Home shows the Sample report card and Start free", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("figure", { name: "Sample Quick Report" })).toContainText("₱42,000/sqm");
    await expect(page.getByRole("link", { name: /Start free/ }).first()).toHaveAttribute("href", "/register");
    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(ld!)["@type"]).toBe("Organization");
  });

  test("AC-005: disclaimer is visible before scrolling past the product table", async ({ page }) => {
    await page.goto("/feasibility-study");
    const note = page.getByRole("note").filter({ hasText: "not a licensed appraisal" });
    const table = page.getByRole("table");
    await table.scrollIntoViewIfNeeded();
    const n = await note.boundingBox();
    const t = await table.boundingBox();
    expect(n!.y).toBeLessThan(t!.y);
    await expect(note).toBeInViewport();
  });

  test("signed-in visitors see Go to dashboard", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "grid_signed_in", value: "1", url: baseURL! }]);
    await page.goto("/");
    // Role queries skip hidden elements (mobile menu closed), so match the anchors directly.
    await expect(page.locator('header a[href="/app"]').first()).toBeAttached();
    await expect(page.locator('header a[href="/register"]')).toHaveCount(0);
  });

  test("sitemap and robots respond; previews are not indexable", async ({ request }) => {
    expect(await (await request.get("/sitemap.xml")).text()).toContain("/feasibility-study");
    expect(await (await request.get("/robots.txt")).text()).toMatch(/Disallow: \//);
  });
});

test.describe("mobile menu", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test("opens, navigates and closes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "How it works" }).click();
    await expect(page).toHaveURL(/how-it-works/);
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("AC-006: FAQ items expand and collapse", async ({ page }) => {
    await page.goto("/how-it-works");
    const item = page.locator("details").first();
    await expect(item).not.toHaveAttribute("open", "");
    await item.locator("summary").click();
    await expect(item).toHaveAttribute("open", "");
    await item.locator("summary").click();
    await expect(item).not.toHaveAttribute("open", "");
  });
});

test("design board and health check still work", async ({ page, request }) => {
  await page.goto("/design");
  await expect(page.getByRole("heading", { name: "Palette" })).toBeVisible();
  const body = await (await request.get("/api/health")).json();
  expect(JSON.stringify(body)).not.toMatch(/postgres(ql)?:\/\//);
});
