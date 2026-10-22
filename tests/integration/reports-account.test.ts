import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { registerAccount, validateSession, authenticate } from "@/lib/auth/service";
import { changePassword, deleteAccount, logoutEverywhere, regenerateRecoveryKey } from "@/lib/auth/account";
import { getReportForUser, listReports } from "@/lib/db/repos/reports";
import { createReport, productsWithTypicalTimes, removeReport, saveReport } from "@/lib/reports/service";
import { files, pendingFileDeletions, reports, runs, usageEvents, users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
const PW = "mango lamp river seven";
let t: Awaited<ReturnType<typeof createTestDb>>;
let n = 0;

beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());

async function newUser() {
  n++;
  const r = await registerAccount({ username: `acct_${n}_${Date.now() % 1e5}`, password: PW, confirmPassword: PW, acceptTerms: true, address: `10.9.0.${n}` });
  if (!r.ok) throw new Error("register failed");
  return r;
}

describe("reports (S-01, S-06)", () => {
  it("AC-019 / AC-020: users see exactly their own reports, newest first", async () => {
    const a = await newUser();
    const b = await newUser();
    const r1 = await createReport(a.user, "quick_report");
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await createReport(a.user, "executive_summary");
    await new Promise((r) => setTimeout(r, 5));
    const r3 = await createReport(a.user, "feasibility_report");
    await createReport(b.user, "quick_report");
    const list = await listReports(a.user.id);
    expect(list.items.map((i) => i.id)).toEqual([r3.id, r2.id, r1.id]);
    expect(list.total).toBe(3);
    expect(await getReportForUser(b.user.id, r1.id)).toBeNull();
    expect(await getReportForUser(a.user.id, "not-a-uuid")).toBeNull();
  });

  it("filters by title, product and status, 25 per page", async () => {
    const a = await newUser();
    for (let i = 0; i < 27; i++) await createReport(a.user, i % 2 ? "quick_report" : "executive_summary");
    const first = await listReports(a.user.id, { pageSize: 25 });
    expect(first.items).toHaveLength(25);
    expect((await listReports(a.user.id, { page: 2 })).items).toHaveLength(2);
    expect((await listReports(a.user.id, { product: "quick_report" })).total).toBe(13);
    expect((await listReports(a.user.id, { status: "ready" })).total).toBe(0);
    const someId = first.items[0]!.id;
    await saveReport(a.user, someId, { title: "C6 Calzada 100% lot" });
    expect((await listReports(a.user.id, { q: "100%" })).items.map((i) => i.id)).toEqual([someId]);
    expect((await listReports(a.user.id, { q: "%" })).total).toBe(1); // % is literal, not a wildcard
  });

  it("validates autosave payloads and never touches other users' reports", async () => {
    const a = await newUser();
    const b = await newUser();
    const r = await createReport(a.user, "quick_report");
    expect((await saveReport(a.user, r.id, { intake: { "qd.lot_area": 15000 } })).ok).toBe(true);
    expect((await saveReport(a.user, r.id, { title: "" })).ok).toBe(false);
    expect((await saveReport(a.user, r.id, { surprise: 1 })).ok).toBe(false);
    expect((await saveReport(a.user, r.id, { intake: { big: "x".repeat(210_000) } })).ok).toBe(false);
    expect(await saveReport(b.user, r.id, { title: "hijack" })).toMatchObject({ ok: false, status: 404 });
  });

  it("deleting a report removes its runs and queues its UploadThing files", async () => {
    const a = await newUser();
    const r = await createReport(a.user, "executive_summary");
    await t.db.insert(runs).values({ reportId: r.id, product: "executive_summary", pipelineId: "p", status: "failed" });
    await t.db.insert(files).values({ reportId: r.id, utKey: `ut_${r.id}`, name: "title.pdf", mimeType: "application/pdf", sizeBytes: 1000, deleteAfter: new Date() });
    expect(await removeReport(a.user, r.id)).toBe(true);
    expect(await t.db.select().from(reports).where(eq(reports.id, r.id))).toHaveLength(0);
    expect(await t.db.select().from(runs).where(eq(runs.reportId, r.id))).toHaveLength(0);
    expect(await t.db.select().from(pendingFileDeletions).where(eq(pendingFileDeletions.utKey, `ut_${r.id}`))).toHaveLength(1);
    const ev = await t.db.select().from(usageEvents).where(eq(usageEvents.userPublicId, a.user.publicId));
    expect(ev.map((e) => e.event)).toEqual(expect.arrayContaining(["report.created", "report.deleted"]));
  });

  it("AC-021: typical time is the GRID estimate until 20 successful runs, then the median", async () => {
    const a = await newUser();
    const r = await createReport(a.user, "executive_summary");
    const add = async (ms: number) => {
      await t.db.insert(runs).values({ reportId: r.id, product: "executive_summary", pipelineId: "p", status: "succeeded", durationMs: ms, finishedAt: new Date() });
    };
    for (let i = 0; i < 19; i++) await add(60_000);
    let es = (await productsWithTypicalTimes()).find((p) => p.key === "executive_summary")!;
    expect(es.typicalIsEstimate).toBe(true);
    expect(es.typicalMs).toBe(30 * 60_000);
    await add(60_000);
    es = (await productsWithTypicalTimes()).find((p) => p.key === "executive_summary")!;
    expect(es.typicalIsEstimate).toBe(false);
    expect(es.typicalMs).toBe(60_000);
  });
});

describe("account (S-07)", () => {
  it("AU-09: changing the password ends other sessions and issues one for this device", async () => {
    const a = await newUser();
    const other = await authenticate({ username: a.user.displayUsername, password: PW, address: "10.8.0.1" });
    const NEW = "copper lantern meadow five";
    const bad = await changePassword(a.user, { current: "nope", password: NEW, confirmPassword: NEW });
    expect(bad.ok).toBe(false);
    const r = await changePassword(a.user, { current: PW, password: NEW, confirmPassword: NEW });
    expect(r.ok).toBe(true);
    expect(await validateSession(a.session.token)).toBeNull();
    expect(other.ok && (await validateSession(other.session.token))).toBeNull();
    expect(r.ok && (await validateSession(r.session.token))).not.toBeNull();
  });

  it("new recovery key needs the password and replaces the old one", async () => {
    const a = await newUser();
    expect((await regenerateRecoveryKey(a.user, "wrong")).ok).toBe(false);
    const r = await regenerateRecoveryKey(a.user, PW);
    expect(r.ok).toBe(true);
    const [row] = await t.db.select().from(users).where(eq(users.id, a.user.id));
    expect(await verifyPassword(row!.recoveryKeyHash, a.recoveryKey)).toBe(false);
    expect(r.ok && (await verifyPassword(row!.recoveryKeyHash, r.recoveryKey))).toBe(true);
  });

  it("AC-035: log out of all devices ends every session", async () => {
    const a = await newUser();
    const b = await authenticate({ username: a.user.displayUsername, password: PW, address: "10.8.0.2" });
    await logoutEverywhere(a.user);
    expect(await validateSession(a.session.token)).toBeNull();
    expect(b.ok && (await validateSession(b.session.token))).toBeNull();
  });

  it("AC-034: deleting the account leaves no row with the username; files are queued; events keep only the ID", async () => {
    const a = await newUser();
    const r = await createReport(a.user, "executive_summary");
    await t.db.insert(files).values({ reportId: r.id, utKey: `ut_acc_${r.id}`, name: "x.pdf", mimeType: "application/pdf", sizeBytes: 1, deleteAfter: new Date() });
    expect((await deleteAccount(a.user, "someone_else")).ok).toBe(false);
    expect((await deleteAccount(a.user, a.user.displayUsername.toUpperCase())).ok).toBe(true);
    const dump = await t.db.execute(sql`
      select (select count(*) from users where lower(username) = lower(${a.user.username}))::int as users_left,
             (select count(*) from reports where user_id = ${a.user.id})::int as reports_left`);
    expect((dump as unknown as { rows: object[] }).rows[0]).toEqual({ users_left: 0, reports_left: 0 });
    expect(await t.db.select().from(pendingFileDeletions).where(eq(pendingFileDeletions.utKey, `ut_acc_${r.id}`))).toHaveLength(1);
    const ev = await t.db.select().from(usageEvents).where(eq(usageEvents.userPublicId, a.user.publicId));
    expect(ev.map((e) => e.event)).toContain("user.deleted");
    expect(JSON.stringify(ev)).not.toContain(a.user.username);
  });
});
