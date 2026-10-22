import type { Page } from "@playwright/test";

let seq = 0;
/** Each test gets its own (fake) client address so per-address limits do not interfere. */
export async function freshAddress(page: Page) {
  seq++;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${Math.floor(Math.random() * 250)}.${(seq % 250) + 1}` });
}

export const PASSWORD = "mango lamp river seven";
export const uniqueName = (prefix = "user") => `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

export async function register(page: Page, username = uniqueName(), password = PASSWORD) {
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel(/I accept the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/register/recovery-key**");
  return username;
}

export async function login(page: Page, username: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}
