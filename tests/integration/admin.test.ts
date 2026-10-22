/**
 * Admin usage monitoring (BRD section 11, AD-01 to AD-05): figures, privacy (PV-01, PV-02), support
 * actions and the audit log (PV-06), the rollup (11.4).
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { registerAccount, resetPassword, validateSession } from "@/lib/auth/service";
import { createReport } from "@/lib/reports/service";
import { auditLog, files, runs, usageDaily, users } from "@/lib/db/schema";
import { listRuns, listUsers, manilaDate, pipelineStats, runDetail, topUsers, usageSeries, usageSummary, userDetail } from "@/lib/db/repos/admin";
import { exportCsv, issueResetCode, periodFrom, pipelines, reactivateUser, runRollup, suspendUser } from "@/lib/admin/service";
import { track } from "@/lib/usage/track";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
const PW = "mango lamp river seven";
let t: Awaited<ReturnType<typeof createTestDb>>;
const NAMES = ["maria.santos", "juan_delacruz", "ana.reyes"];
const TITLE = "Secret Title Riverside Lot";
const FILE = "titulo-maria.pdf";
type Seeded = Extract<Awaited<ReturnType<typeof registerAccount>>, { ok: true }>;
const seeded: Seeded[] = [];
const admin = { publicId: "U-ADM1N0" };
const period = periodFrom({ range: "30d" }).period;

beforeAll(async () => {
  t = await createTestDb();
  for (const [i, name] of NAMES.entries()) {
    const r = await registerAccount({ username: name, password: PW, confirmPassword: PW, acceptTerms: true, address: `10.5.0.${i}` });
    if (!r.ok) throw new Error("register");
    seeded.push(r);
  }
  // 10 runs: 7 succeeded, 2 failed, 1 queued, across the three users.
  const statuses = ["succeeded", "succeeded", "succeeded", "succeeded", "succeeded", "succeeded", "succeeded", "failed", "failed", "queued"] as const;
  for (const [i, status] of statuses.entries()) {
    const u = seeded[i % 3]!.user;
    const rep = await createReport(u, i % 2 ? "quick_report" : "executive_summary");
    await t.db.execute(sql`update reports set title = ${TITLE} where id = ${rep.id}`);
    const started = new Date(Date.now() - (i + 1) * 3600_000);
    await t.db.insert(runs).values({
      reportId: rep.id, product: rep.product, pipelineId: `mock-${rep.product}`, attempt: 1, status, phase: "done",
      errorCode: status === "failed" ? "VS_TIMEOUT" : null, vsRunId: `vs_${i}`, httpStatus: 200, durationMs: 60_000 + i * 1000,
      queuedAt: started, startedAt: started, finishedAt: status === "queued" ? null : new Date(started.getTime() + 60_000),
    });
    await track(u.publicId, "run.started", { product: rep.product });
    if (status === "succeeded") await track(u.publicId, "run.succeeded", { product: rep.product, durationMs: 60_000 + i * 1000 });
    if (status === "failed") await track(u.publicId, "run.failed", { product: rep.product, errorCode: "VS_TIMEOUT" });
    if (i === 0) await t.db.insert(files).values({ reportId: rep.id, utKey: "ut_admin_1", name: FILE, mimeType: "application/pdf", sizeBytes: 2048, deleteAfter: new Date(Date.now() + 1e9) });
  }
});
afterAll(async () => t.close());

describe("AD-01 overview", () => {
  it("AC-036: 3 registered users and 10 runs in the 30-day view", async () => {
    const s = await usageSummary(period);
    expect(s.registered).toBe(3);
    expect(s.runs).toBe(10);
    expect(s.successRate).toBeCloseTo(7 / 9);
    expect(s.medianMs).toBeGreaterThan(0);
    expect(s.storageBytes).toBe(2048);
    const series = await usageSeries(period);
    expect(series.runs.reduce((a, r) => a + r.n, 0)).toBe(10);
    expect(series.failures).toEqual([{ code: "VS_TIMEOUT", n: 2 }]);
    expect((await topUsers(period)).length).toBe(3);
  });
});

describe("privacy (PV-01, PV-02)", () => {
  it("AC-037: no admin read or CSV contains a seeded username, title or file name", async () => {
    const u = seeded[0]!.user;
    const firstRun = (await listRuns({})).items[0]!;
    const outputs = [
      await usageSummary(period), await usageSeries(period), await topUsers(period), await listUsers({ period }), await userDetail(u.publicId),
      await listRuns({}), await runDetail(firstRun.id), await pipelines(), await pipelineStats("quick_report"),
      await exportCsv("users", period, admin.publicId), await exportCsv("runs", period, admin.publicId), await exportCsv("daily", period, admin.publicId),
    ];
    const dump = JSON.stringify(outputs).toLowerCase();
    for (const s of [...NAMES, TITLE.toLowerCase(), FILE, "argon2"]) expect(dump).not.toContain(s.toLowerCase());
  });

  it("AC-038: searching part of a username finds nothing unless it matches a User ID", async () => {
    expect((await listUsers({ q: "maria", period })).items).toHaveLength(0);
    const id = seeded[1]!.user.publicId;
    expect((await listUsers({ q: id.slice(2, 6).toLowerCase(), period })).items.map((i) => i.public_id)).toContain(id);
  });

  it("AC-039: the users CSV has no username column", async () => {
    const csv = await exportCsv("users", period, admin.publicId);
    const header = csv.split("\r\n")[0]!;
    expect(header).toBe("user_id,role,status,registered,last_active,runs,succeeded,failed,files,storage_bytes");
    expect(csv).not.toMatch(/username/i);
    const audits = await t.db.select().from(auditLog).where(eq(auditLog.action, "export.users"));
    expect(audits.length).toBeGreaterThan(0);
  });

  it("PV-01: the admin_reader role reads the views but not the users table", async () => {
    await t.client.exec(readFileSync("scripts/admin-reader-role.sql", "utf8"));
    await t.client.exec("SET ROLE admin_reader");
    try {
      await expect(t.client.query("select count(*) from admin_users_v")).resolves.toBeTruthy();
      await expect(t.client.query("select count(*) from usage_daily")).resolves.toBeTruthy();
      await expect(t.client.query("select username from users")).rejects.toThrow(/permission denied/);
      await expect(t.client.query("select * from reports")).rejects.toThrow(/permission denied/);
      await expect(t.client.query("select * from envelopes")).rejects.toThrow(/permission denied/);
      await expect(t.client.query("select name from files")).rejects.toThrow(/permission denied/);
    } finally {
      await t.client.exec("RESET ROLE");
    }
  });
});

describe("AD-03 support actions (PV-06)", () => {
  it("suspend ends sessions and is audited; reactivate restores", async () => {
    const target = seeded[2]!;
    expect(await validateSession(target.session.token)).not.toBeNull();
    expect(await suspendUser(admin, target.user.publicId)).toEqual({ ok: true });
    expect(await validateSession(target.session.token)).toBeNull();
    const [row] = await t.db.select().from(users).where(eq(users.id, target.user.id));
    expect(row!.status).toBe("suspended");
    expect(await reactivateUser(admin, target.user.publicId)).toEqual({ ok: true });
    const acts = await t.db.select().from(auditLog).where(eq(auditLog.targetPublicId, target.user.publicId));
    expect(acts.map((a) => a.action)).toEqual(expect.arrayContaining(["user.suspended", "user.reactivated"]));
    expect(await suspendUser(admin, admin.publicId)).toMatchObject({ ok: false });
  });

  it("AC-041: a reset code is audited with admin ID, target ID and time, and works once", async () => {
    const target = seeded[1]!;
    const r = await issueResetCode(admin, target.user.publicId);
    if (!r.ok || !r.code) throw new Error("no code");
    const [a] = await t.db.select().from(auditLog).where(eq(auditLog.action, "user.reset_code_issued"));
    expect(a).toMatchObject({ adminPublicId: "U-ADM1N0", targetPublicId: target.user.publicId });
    expect(a!.at).toBeInstanceOf(Date);
    const ok = await resetPassword({ username: NAMES[1]!, secret: r.code, password: "a brand new pass phrase", confirmPassword: "a brand new pass phrase", address: "10.5.1.1" });
    expect(ok.ok).toBe(true);
    const again = await resetPassword({ username: NAMES[1]!, secret: r.code, password: "another new pass phrase", confirmPassword: "another new pass phrase", address: "10.5.1.2" });
    expect(again.ok).toBe(false);
  });
});

describe("rollup (11.4)", () => {
  it("writes usage_daily rows for today and is idempotent", async () => {
    await runRollup(new Date(), { todayOnly: true });
    await runRollup(new Date(), { todayOnly: true });
    const rows = await t.db.select().from(usageDaily).where(eq(usageDaily.date, manilaDate(new Date())));
    const started = rows.filter((r) => r.event === "run.started").reduce((a, r) => a + r.count, 0);
    expect(started).toBeGreaterThan(0);
    expect(started).toBeLessThanOrEqual(10);
  });
});
