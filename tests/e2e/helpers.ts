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

export async function signUpAndStartQuick(page: Page) {
  await freshAddress(page);
  await register(page);
  await page.getByLabel("I have saved my recovery key.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app");
  await page.getByRole("button", { name: "Start Quick Report" }).click();
  await page.waitForURL(/\/app\/new\/quick_report\?id=/);
  return new URL(page.url()).searchParams.get("id")!;
}

export async function choose(page: Page, label: string | RegExp, option: string) {
  await page.getByLabel(label).selectOption({ label: option });
}

export async function fillQuickReport(page: Page) {
  await choose(page, "Region", "NCR");
  await choose(page, "Province", "Metro Manila");
  await choose(page, "City or municipality", "Taguig");
  await choose(page, "Lot area", "about 15,000 sqm");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await choose(page, "Asking price per sqm", "₱40,000 per sqm");
  await choose(page, "Comparable listings, lowest", "₱30,000 per sqm");
  await choose(page, "Comparable listings, highest", "₱50,000 per sqm");
  await page.getByRole("button", { name: "Next" }).click();
}

