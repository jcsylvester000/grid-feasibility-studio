import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { authenticate, LIMITS, registerAccount, resetPassword, validateSession } from "@/lib/auth/service";
import { sha256 } from "@/lib/auth/crypto";
import { hashPassword } from "@/lib/auth/password";
import { insertResetCode } from "@/lib/db/repos/reset-codes";
import { authAttempts, resetCodes, sessions, usageEvents, users } from "@/lib/db/schema";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
const PW = "mango lamp river seven";
let t: Awaited<ReturnType<typeof createTestDb>>;
let n = 0;
const uname = () => `user_${++n}_${Date.now() % 100000}`;
const addr = () => `10.0.0.${n}`;

beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());
beforeEach(async () => {
  await t.db.delete(authAttempts);
});

async function register(username = uname(), address = addr()) {
  const r = await registerAccount({ username, password: PW, confirmPassword: PW, acceptTerms: true, address });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
}

describe("registration (A-01)", () => {
  it("AC-007: creates a U- User ID, a session and a recovery key; stores only hashes", async () => {
    const r = await register("Maria.Santos");
    expect(r.user.publicId).toMatch(/^U-[0-9A-Z]{6}$/);
    expect(r.recoveryKey).toHaveLength(20);
    const [row] = await t.db.select().from(users).where(eq(users.id, r.user.id));
    expect(row!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row!.recoveryKeyHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(row)).not.toContain(r.recoveryKey);
    expect(row!.role).toBe("user");
    const [s] = await t.db.select().from(sessions).where(eq(sessions.tokenHash, sha256(r.session.token)));
    expect(s).toBeTruthy();
  });
  it("refuses a taken username regardless of case", async () => {
    const r = await registerAccount({ username: "MARIA.SANTOS", password: PW, confirmPassword: PW, acceptTerms: true, address: addr() });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.fieldErrors?.username).toMatch(/taken/);
  });
  it("requires accepting terms and matching passwords", async () => {
    const r = await registerAccount({ username: uname(), password: PW, confirmPassword: PW + "x", acceptTerms: false, address: addr() });
    expect(!r.ok && r.fieldErrors).toMatchObject({ confirmPassword: expect.any(String), acceptTerms: expect.any(String) });
  });
  it("AU-11: limits 5 registrations per address per hour", async () => {
    const a = "192.168.9.9";
    for (let i = 0; i < 5; i++) await register(uname(), a);
    const r = await registerAccount({ username: uname(), password: PW, confirmPassword: PW, acceptTerms: true, address: a });
    expect(!r.ok && r.formError).toBe("RATE_LIMITED");
  });
  it("PV-03: usage events carry the User ID only", async () => {
    const r = await register("events.check");
    const ev = await t.db.select().from(usageEvents).where(eq(usageEvents.userPublicId, r.user.publicId));
    expect(ev.map((e) => e.event)).toContain("user.registered");
    expect(JSON.stringify(ev)).not.toContain("events.check");
  });
});

describe("login (A-03, AU-10)", () => {
  it("AC-014: correct password creates a session", async () => {
    const { user } = await register();
    const r = await authenticate({ username: user.displayUsername, password: PW, address: addr() });
    expect(r.ok).toBe(true);
  });
  it("uses the same neutral result for a wrong password and an unknown username", async () => {
    const { user } = await register();
    const a = await authenticate({ username: user.displayUsername, password: "wrong wrong wrong", address: addr() });
    const b = await authenticate({ username: "nobody_here_123", password: "wrong wrong wrong", address: addr() });
    expect(a).toEqual({ ok: false, code: "INVALID" });
    expect(b).toEqual({ ok: false, code: "INVALID" });
  });
  it("AC-015: after five failures in 15 minutes the right password is refused with the unlock time", async () => {
    const { user } = await register();
    const now = new Date("2026-10-22T02:30:00Z");
    for (let i = 0; i < 5; i++)
      await authenticate({ username: user.displayUsername, password: "nope nope nope", address: `172.16.0.${i}`, now });
    const r = await authenticate({ username: user.displayUsername, password: PW, address: "172.16.1.1", now });
    expect(r).toMatchObject({ ok: false, code: "LOCKED" });
    expect(!r.ok && r.unlockAt?.toISOString()).toBe(new Date(now.getTime() + LIMITS.lockMs).toISOString());
    const later = new Date(now.getTime() + LIMITS.lockMs + 1000);
    expect((await authenticate({ username: user.displayUsername, password: PW, address: "172.16.1.1", now: later })).ok).toBe(true);
  });
  it("locks an address after 20 failures across usernames", async () => {
    const now = new Date();
    for (let i = 0; i < 20; i++) await authenticate({ username: `ghost_${i}`, password: "x", address: "203.0.113.7", now });
    const r = await authenticate({ username: "ghost_x", password: "x", address: "203.0.113.7", now });
    expect(r).toMatchObject({ code: "LOCKED" });
  });
  it("stores addresses only as keyed hashes (AU-11)", async () => {
    await authenticate({ username: "ghost", password: "x", address: "198.51.100.23" });
    const rows = await t.db.select().from(authAttempts);
    expect(JSON.stringify(rows)).not.toContain("198.51.100.23");
  });
  it("refuses suspended accounts and drops their sessions (AU-13)", async () => {
    const r = await register();
    await t.db.update(users).set({ status: "suspended" }).where(eq(users.id, r.user.id));
    expect(await validateSession(r.session.token)).toBeNull();
    expect((await t.db.select().from(sessions).where(eq(sessions.userId, r.user.id))).length).toBe(0);
    expect(await authenticate({ username: r.user.displayUsername, password: PW, address: addr() })).toMatchObject({ code: "SUSPENDED" });
  });
});

describe("sessions (AU-07, AU-08)", () => {
  it("slides the idle expiry at most once a day and never past the absolute limit", async () => {
    const r = await register();
    const s0 = await validateSession(r.session.token);
    expect(s0?.refreshed).toBe(false);
    const in2days = new Date(Date.now() + 2 * 86400_000);
    const s1 = await validateSession(r.session.token, in2days);
    expect(s1?.refreshed).toBe(true);
    expect(s1!.expiresAt.getTime()).toBeCloseTo(in2days.getTime() + LIMITS.sessionIdleMs, -3);
  });
  it("expires after 7 idle days", async () => {
    const r = await register();
    expect(await validateSession(r.session.token, new Date(Date.now() + 8 * 86400_000))).toBeNull();
  });
  it("expires 30 days after login even with activity", async () => {
    const r = await register();
    const start = Date.now();
    for (const d of [6, 12, 18, 24, 29]) expect(await validateSession(r.session.token, new Date(start + d * 86400_000))).not.toBeNull();
    expect(await validateSession(r.session.token, new Date(Date.now() + 31 * 86400_000))).toBeNull();
  });
});

describe("reset (A-04, AU-09)", () => {
  it("AC-017: correct key resets; old sessions and the old key stop working; new key is issued", async () => {
    const r = await register();
    const NEW = "ocean kettle window nine";
    const res = await resetPassword({
      username: r.user.displayUsername,
      secret: r.recoveryKey.toLowerCase().replace(/(.{4})/g, "$1-"),
      password: NEW,
      confirmPassword: NEW,
      address: addr(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(await validateSession(r.session.token)).toBeNull();
    expect(await validateSession(res.session.token)).not.toBeNull();
    expect(res.recoveryKey).not.toBe(r.recoveryKey);
    const again = await resetPassword({ username: r.user.displayUsername, secret: r.recoveryKey, password: NEW + "x", confirmPassword: NEW + "x", address: addr() });
    expect(again).toMatchObject({ ok: false, code: "INVALID" });
    expect((await authenticate({ username: r.user.displayUsername, password: NEW, address: addr() })).ok).toBe(true);
  });
  it("accepts a valid admin reset code once", async () => {
    const r = await register();
    await insertResetCode({ userId: r.user.id, codeHash: await hashPassword("ABCDEFGHJKMN"), issuedByPublicId: "U-ADMIN1", expiresAt: new Date(Date.now() + 3600_000) });
    const NEW = "ocean kettle window ten";
    expect((await resetPassword({ username: r.user.displayUsername, secret: "abcd-efgh-jkmn", password: NEW, confirmPassword: NEW, address: addr() })).ok).toBe(true);
    const [code] = await t.db.select().from(resetCodes).where(eq(resetCodes.userId, r.user.id));
    expect(code!.usedAt).not.toBeNull();
  });
  it("AC-018: refuses a reset code older than 24 hours", async () => {
    const r = await register();
    await insertResetCode({ userId: r.user.id, codeHash: await hashPassword("PQRSTVWXYZ01"), issuedByPublicId: "U-ADMIN1", expiresAt: new Date(Date.now() + 86400_000) });
    const NEW = "ocean kettle window eleven";
    const res = await resetPassword({
      username: r.user.displayUsername, secret: "PQRSTVWXYZ01", password: NEW, confirmPassword: NEW, address: addr(),
      now: new Date(Date.now() + 25 * 3600_000),
    });
    expect(res).toMatchObject({ ok: false, code: "INVALID" });
  });
  it("counts wrong keys toward the username lock", async () => {
    const r = await register();
    const NEW = "ocean kettle window twelve";
    for (let i = 0; i < 5; i++)
      await resetPassword({ username: r.user.displayUsername, secret: "WRONGWRONGWRONGWRONG", password: NEW, confirmPassword: NEW, address: addr() });
    expect(await authenticate({ username: r.user.displayUsername, password: PW, address: addr() })).toMatchObject({ code: "LOCKED" });
    const rows = (await t.db.execute(sql`select count(*)::int as c from auth_attempts where kind='login'`)).rows as { c: number }[];
    expect(rows[0]?.c).toBeGreaterThanOrEqual(5);
  });
});
