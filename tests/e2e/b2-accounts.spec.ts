import { expect, test } from "@playwright/test";
import { freshAddress, login, PASSWORD, register, uniqueName } from "./helpers";

test.beforeEach(async ({ page }) => freshAddress(page));

test("AC-011: register form has no email field and no role choice", async ({ page }) => {
  await page.goto("/register");
  await expect(page.locator('input[type="email"], input[name*="email" i]')).toHaveCount(0);
  await expect(page.locator('[name="role"], select')).toHaveCount(0);
  await expect(page.getByText("No email needed")).toBeVisible();
});

test("AC-008: a 12-character password is flagged on blur and refused on submit", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Password", { exact: true }).fill("abcdefghijkl");
  await page.getByLabel("Confirm password").focus();
  await expect(page.locator("form [role=alert]").filter({ hasText: "at least 15 characters" })).toBeVisible();
  await page.getByLabel("Username").fill(uniqueName());
  await page.getByLabel("Confirm password").fill("abcdefghijkl");
  await page.getByLabel(/I accept the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("AC-009 and AC-010: common password and reserved username are refused", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Username").fill("Admin");
  await page.getByLabel("Password", { exact: true }).fill("passwordpassword");
  await page.getByLabel("Confirm password").fill("passwordpassword");
  await page.getByLabel(/I accept the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/too common/)).toBeVisible();
  await expect(page.getByText(/reserved/)).toBeVisible();
});

test("AC-007, AC-012, AC-013: register, see the key once, download it, continue", async ({ page }) => {
  await register(page);
  const key = (await page.getByTestId("recovery-key").innerText()).replace(/\s+/g, "");
  const publicId = await page.getByTestId("public-id").innerText();
  expect(key).toMatch(/^[0-9A-Z]{20}$/);
  expect(publicId).toMatch(/^U-[0-9A-Z]{6}$/);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download" }).click()]);
  const text = await (await download.createReadStream())!.toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(text).toContain(publicId);
  expect(text.replace(/-/g, "")).toContain(key);

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "grid_session")?.httpOnly).toBe(true);

  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "This key is no longer shown" })).toBeVisible();
  await expect(page.getByTestId("recovery-key")).toHaveCount(0);
});

test("Continue needs the 'I have saved' tick", async ({ page }) => {
  await register(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/recovery-key/);
});

test("AC-014: login lands on /app within 2 seconds; logout ends the session", async ({ page }) => {
  const name = await register(page);
  await page.context().clearCookies();
  await freshAddress(page);
  await login(page, name);
  const started = Date.now();
  await page.waitForURL("**/app");
  expect(Date.now() - started).toBeLessThan(2000);
  await expect(page.getByText(/Your User ID is U-/)).toBeVisible();
  await page.goto("/");
  await expect(page.locator('header a[href="/app"]').first()).toBeAttached();
  await page.goto("/app");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
});

test("neutral error for wrong password and unknown username", async ({ page }) => {
  const name = await register(page);
  await page.context().clearCookies();
  await login(page, name, "wrong wrong wrong wrong");
  await expect(page.locator("form [role=alert]")).toHaveText("That username and password do not match.");
  await login(page, "nobody_" + name, "wrong wrong wrong wrong");
  await expect(page.locator("form [role=alert]")).toHaveText("That username and password do not match.");
});

test("AC-015: five wrong passwords lock the username with an unlock time", async ({ page }) => {
  const name = await register(page);
  await page.context().clearCookies();
  for (let i = 0; i < 5; i++) {
    await freshAddress(page);
    await login(page, name, `wrong attempt number ${i}`);
    await expect(page.locator("form [role=alert]")).toBeVisible();
  }
  await freshAddress(page);
  await login(page, name, PASSWORD);
  await expect(page.locator("form [role=alert]")).toContainText("Too many attempts. Try again after");
});

test("AC-016: admins land on /admin; users cannot see /admin", async ({ page }) => {
  await login(page, "e2e_admin", "admin pass phrase for tests");
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { name: "Usage overview" })).toBeVisible();
  await page.context().clearCookies();
  await freshAddress(page);
  await register(page);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
});

test("proxy sends signed-out visitors to log in and back to the page they asked for", async ({ page }) => {
  const name = await register(page);
  await page.context().clearCookies();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
  await page.getByLabel("Username").fill(name);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/app");
});

test("AC-017: reset with the recovery key ends old sessions and shows a new key", async ({ page, browser }) => {
  const name = await register(page);
  const oldKey = (await page.getByTestId("recovery-key").innerText()).replace(/\s+/g, "");
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");

  const other = await browser.newPage();
  await freshAddress(other);
  await other.goto("/reset");
  await other.getByLabel("Username").fill(name);
  await other.getByLabel("Recovery key or reset code").fill(oldKey.toLowerCase());
  await other.getByLabel("New password", { exact: true }).fill("ocean kettle window nine");
  await other.getByLabel("Confirm new password").fill("ocean kettle window nine");
  await other.getByRole("button", { name: "Reset password" }).click();
  await other.waitForURL("**/register/recovery-key?from=reset");
  const newKey = (await other.getByTestId("recovery-key").innerText()).replace(/\s+/g, "");
  expect(newKey).not.toBe(oldKey);

  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
  await other.close();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("login works as a plain form", async ({ page, browser }) => {
    const js = await browser.newPage();
    await freshAddress(js);
    const name = await register(js);
    await js.close();
    await page.goto("/login");
    await page.getByLabel("Username").fill(name);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/app");
  });
});
