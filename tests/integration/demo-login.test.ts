/** Demo login (DEMO_LOGIN) and the same-origin check used by every form action. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../helpers/pglite";

let headerMap = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => headerMap.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());
afterEach(() => {
  delete process.env.DEMO_LOGIN;
  delete process.env.DEMO_MODE;
});

describe("demo login", () => {
  it("creates the configured account on first sign-in, then signs in normally", async () => {
    const { ensureDemoAccount } = await import("@/lib/demo/account");
    const { authenticate } = await import("@/lib/auth/service");
    process.env.DEMO_MODE = "true";
    process.env.DEMO_LOGIN = "TestUser1:grid_123456789!";
    expect(await ensureDemoAccount("testuser1", "grid_123456789!")).toBe(true);
    expect(await ensureDemoAccount("TestUser1", "grid_123456789!")).toBe(true); // idempotent
    const r = await authenticate({ username: "TestUser1", password: "grid_123456789!", address: "198.18.9.9" });
    expect(r.ok).toBe(true);
  });

  it("does nothing for other credentials or when demo mode is off", async () => {
    const { ensureDemoAccount } = await import("@/lib/demo/account");
    const { findUserByUsername } = await import("@/lib/db/repos/users");
    process.env.DEMO_LOGIN = "DemoOff1:grid_123456789!";
    expect(await ensureDemoAccount("DemoOff1", "grid_123456789!")).toBe(false); // DEMO_MODE not set (NODE_ENV=test)
    process.env.DEMO_MODE = "true";
    expect(await ensureDemoAccount("DemoOff1", "wrong password here")).toBe(false);
    expect(await findUserByUsername("DemoOff1")).toBeNull();
  });
});

describe("same-origin check", () => {
  const check = async (h: Record<string, string>, appOrigin = "http://localhost:3000") => {
    process.env.APP_ORIGIN = appOrigin;
    headerMap = new Map(Object.entries(h));
    const { isSameOrigin } = await import("@/lib/auth/session");
    return isSameOrigin();
  };
  it("accepts APP_ORIGIN, with or without a trailing slash", async () => {
    expect(await check({ origin: "https://demo.netlify.app" }, "https://demo.netlify.app/")).toBe(true);
  });
  it("accepts the host the site is served on even when APP_ORIGIN is wrong", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await check({ origin: "https://grid-feasibility-studio-demo.netlify.app", host: "grid-feasibility-studio-demo.netlify.app" })).toBe(true);
    expect(await check({ origin: "https://x.netlify.app", "x-forwarded-host": "x.netlify.app", host: "internal:8080" })).toBe(true);
    warn.mockRestore();
  });
  it("refuses other sites and missing origins", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await check({ origin: "https://evil.example", host: "grid-feasibility-studio-demo.netlify.app" })).toBe(false);
    expect(await check({ host: "grid-feasibility-studio-demo.netlify.app" })).toBe(false);
    expect(await check({ origin: "null", host: "a.netlify.app" })).toBe(false);
    warn.mockRestore();
  });
});
