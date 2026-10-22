/**
 * B9-03 accessibility and layout sweep: axe (WCAG 2.2 A/AA rules) on every page type with no serious or
 * critical issue, and no sideways scrolling at 360, 768 and 1280 px.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fillQuickReport, freshAddress, login, register } from "./helpers";

async function audit(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${url}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${url} at ${width}px`).toBeLessThanOrEqual(0);
  }
}

test("public and sign-in pages", async ({ page }) => {
  test.setTimeout(90_000);
  for (const url of ["/", "/feasibility-study", "/how-it-works", "/terms", "/privacy", "/login", "/register", "/reset", "/no-such-page"]) await audit(page, url);
});

test("signed-in pages: dashboard, forms, run page, viewer, account", async ({ page }) => {
  test.setTimeout(120_000);
  await freshAddress(page);
  await register(page);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  for (const url of ["/app", "/app/new", "/app/reports", "/app/account"]) await audit(page, url);

  for (const product of ["Executive Summary", "Feasibility Report"]) {
    await page.goto("/app");
    await page.getByRole("button", { name: `Start ${product}` }).click();
    await page.waitForURL(/id=/);
    await audit(page, page.url());
  }
  await page.goto("/app");
  await page.getByRole("button", { name: "Start Quick Report" }).click();
  await page.waitForURL(/id=/);
  const id = new URL(page.url()).searchParams.get("id")!;
  await fillQuickReport(page);
  await audit(page, page.url());
  await page.getByRole("navigation", { name: "Form steps" }).getByRole("button", { name: /Review/ }).click();
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(`**/app/reports/${id}`, { timeout: 25_000 });
  await audit(page, `/app/reports/${id}`);
  for (const key of ["executive_summary", "feasibility_report", "quick_report_teaser"]) await audit(page, `/design/report/${key}`);
});

test("admin pages", async ({ page }) => {
  test.setTimeout(90_000);
  await freshAddress(page);
  await login(page, "e2e_admin", "admin pass phrase for tests");
  await page.waitForURL("**/admin");
  for (const url of ["/admin", "/admin/users", "/admin/runs", "/admin/pipelines", "/admin/users/U-ADM1N0"]) await audit(page, url);
});

test("security headers are sent (SE-01)", async ({ page }) => {
  const res = await page.goto("/");
  const h = res!.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("https://*.ufs.sh");
  expect(h["strict-transport-security"]).toContain("max-age=63072000");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

/** PF-03: first-load JavaScript (gzip) per page group. Budgets pending GRID's decision (GFS-06). */
test("JavaScript budgets for signed-in and admin pages", async ({ page, browserName }, info) => {
  test.skip(info.project.name !== "desktop" || browserName !== "chromium", "measured once");
  test.setTimeout(90_000);
  const { gzipSync } = await import("node:zlib");
  const measure = async (url: string) => {
    const seen = new Map<string, number>();
    const onResponse = async (r: import("@playwright/test").Response) => {
      if (r.request().resourceType() !== "script" || !r.ok()) return;
      try {
        seen.set(r.url(), gzipSync(await r.body()).length);
      } catch {}
    };
    page.on("response", onResponse);
    await page.goto(url, { waitUntil: "networkidle" });
    page.off("response", onResponse);
    return [...seen.values()].reduce((a, b) => a + b, 0) / 1024;
  };
  await freshAddress(page);
  await register(page);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  const results: [string, number, number][] = [];
  for (const url of ["/app", "/app/new", "/app/reports", "/app/account"]) results.push([url, await measure(url), 220]);
  await page.goto("/app");
  await page.getByRole("button", { name: "Start Feasibility Report" }).click();
  await page.waitForURL(/id=/);
  results.push(["/app/new/feasibility_report", await measure(page.url()), 220]);
  await page.context().clearCookies();
  await freshAddress(page);
  await login(page, "e2e_admin", "admin pass phrase for tests");
  await page.waitForURL("**/admin");
  for (const url of ["/admin", "/admin/users", "/admin/runs"]) results.push([url, await measure(url), 250]);
  info.annotations.push({ type: "budgets", description: results.map(([u, kb, b]) => `${u} ${kb.toFixed(1)}/${b} KB`).join("; ") });
  for (const [url, kb, budget] of results) expect(kb, `${url} ${kb.toFixed(1)} KB`).toBeLessThanOrEqual(budget);
});
