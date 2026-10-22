import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { handleMockRequest, mockLog } from "@/mock/vectorshift/handler";
import { registerAccount } from "@/lib/auth/service";
import { createReport, saveReport } from "@/lib/reports/service";
import { executeRun, setFileLoader } from "@/lib/runs/worker";
import { cancelRun, getRunStatus, startRun } from "@/lib/runs/service";
import { envelopes, reports, runs, usageEvents } from "@/lib/db/schema";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
process.env.RUN_DISPATCH = "none";
process.env.VECTORSHIFT_BASE_URL = "http://localhost:4010";
process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report";
process.env.VS_PIPELINE_EXECUTIVE_SUMMARY = "mock-executive_summary";

const INTAKE = {
  "property.region": "NCR", "property.province": "Metro Manila", "property.city": "Taguig",
  "qd.lot_area": 15000, "qd.ask_psqm": 40000, "qd.comp_low": 30000, "qd.comp_high": 50000,
};

/** Routes the worker's fetch to the in-process mock, honouring abort (timeouts). */
const mockFetch = (delayMs = 0): typeof fetch => (input, init) =>
  new Promise<Response>((resolve, reject) => {
    const signal = init?.signal;
    signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    handleMockRequest(new Request(String(input), init), { delayMs }).then(resolve, reject);
  });

let t: Awaited<ReturnType<typeof createTestDb>>;
let n = 0;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());
afterEach(() => {
  delete process.env.VS_PIPELINE_QUICK_REPORT_OVERRIDE;
  process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report";
  delete process.env.VS_TIMEOUT_MS_QUICK_REPORT;
});

async function setup(product: "quick_report" | "executive_summary" = "quick_report") {
  n++;
  const r = await registerAccount({ username: `runner_${n}_${Date.now() % 1e5}`, password: "mango lamp river seven", confirmPassword: "mango lamp river seven", acceptTerms: true, address: `10.7.0.${n}` });
  if (!r.ok) throw new Error("register");
  const report = await createReport(r.user, product);
  await saveReport(r.user, report.id, { intake: INTAKE });
  return { user: r.user, report };
}

async function start(scenario?: string) {
  if (scenario) process.env.VS_PIPELINE_QUICK_REPORT = `mock-quick_report--${scenario}`;
  const s = await setup();
  const started = await startRun(s.user, s.report.id);
  if (!started.ok) throw new Error(JSON.stringify(started));
  return { ...s, runId: started.runId };
}

const runRow = async (id: string) => (await t.db.select().from(runs).where(eq(runs.id, id)))[0]!;
const reportRow = async (id: string) => (await t.db.select().from(reports).where(eq(reports.id, id)))[0]!;

describe("run worker (BRD 7.3)", () => {
  it("succeeds against the mock: stores the validated envelope, report ready, events written", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((m) => void logs.push(String(m)));
    const { user, report, runId } = await start();
    const out = await executeRun(runId, { fetchImpl: mockFetch() });
    spy.mockRestore();
    expect(out).toMatchObject({ claimed: true, status: "succeeded" });
    const run = await runRow(runId);
    expect(run).toMatchObject({ status: "succeeded", phase: "done", errorCode: null, httpStatus: 200 });
    expect(run.vsRunId).toMatch(/^mockrun_/);
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect((await reportRow(report.id)).status).toBe("ready");
    const [env] = await t.db.select().from(envelopes).where(eq(envelopes.runId, runId));
    expect(env!.product).toBe("quick_report");
    const ev = (await t.db.select().from(usageEvents).where(eq(usageEvents.userPublicId, user.publicId))).map((e) => e.event);
    expect(ev).toEqual(expect.arrayContaining(["run.started", "run.succeeded"]));
    // VS-09: one log line with ids and sizes, never inputs or outputs.
    const line = logs.find((l) => l.includes('"vs.call"'))!;
    expect(JSON.parse(line)).toMatchObject({ runId, product: "quick_report", http: 200, code: null });
    expect(line).not.toContain("Taguig");
    expect(line).not.toContain("Marginal");
  });

  it("claims a run only once (a run is never sent twice)", async () => {
    const { runId } = await start();
    const [a, b] = await Promise.all([executeRun(runId, { fetchImpl: mockFetch() }), executeRun(runId, { fetchImpl: mockFetch() })]);
    expect([a.claimed, b.claimed].sort()).toEqual([false, true]);
  });

  const cases: [string, string, boolean][] = [
    ["auth", "VS_AUTH", false],
    ["bad_request", "VS_BAD_REQUEST", false],
    ["server_error", "VS_FAILED", false],
    ["failed", "VS_FAILED", false],
    ["missing_output", "VS_OUTPUT_MISSING", false],
    ["invalid_json", "SCHEMA_INVALID", false],
    ["schema_invalid", "SCHEMA_INVALID", false],
    ["envelope_failed", "INPUT_INSUFFICIENT", false],
    ["unavailable", "VS_UNAVAILABLE", true],
  ];
  for (const [scenario, code, retried] of cases) {
    it(`maps ${scenario} to ${code}${retried ? " and queues one automatic retry" : ""}`, async () => {
      const { report, runId } = await start(scenario);
      await executeRun(runId, { fetchImpl: mockFetch() });
      const run = await runRow(runId);
      expect(run.status).toBe("failed");
      expect(run.errorCode).toBe(code);
      expect((await reportRow(report.id)).status).toBe(retried ? "queued" : "failed");
      const all = await t.db.select().from(runs).where(eq(runs.reportId, report.id));
      expect(all).toHaveLength(retried ? 2 : 1);
      if (retried) expect(all.find((r) => r.attempt === 2)).toMatchObject({ status: "queued" });
      if (code === "SCHEMA_INVALID") {
        expect(run.rawFailureBody).toBeTruthy();
        expect(run.rawFailureExpiresAt!.getTime() - Date.now()).toBeGreaterThan(29 * 86400_000);
        expect(await t.db.select().from(envelopes).where(eq(envelopes.runId, runId))).toHaveLength(0); // never stored
      }
    });
  }

  it("times out with VS_TIMEOUT, retries once for the Quick Report, then stops", async () => {
    process.env.VS_TIMEOUT_MS_QUICK_REPORT = "200";
    const { report, runId } = await start("timeout");
    await executeRun(runId, { fetchImpl: mockFetch() });
    expect((await runRow(runId)).errorCode).toBe("VS_TIMEOUT");
    const retry = (await t.db.select().from(runs).where(eq(runs.reportId, report.id))).find((r) => r.attempt === 2)!;
    await executeRun(retry.id, { fetchImpl: mockFetch() });
    expect((await runRow(retry.id)).errorCode).toBe("VS_TIMEOUT");
    expect(await t.db.select().from(runs).where(eq(runs.reportId, report.id))).toHaveLength(2);
    expect((await reportRow(report.id)).status).toBe("failed");
  });

  it("VS-11: a cancelled run ignores the late result", async () => {
    const { user, report, runId } = await start();
    const pending = executeRun(runId, { fetchImpl: mockFetch(300) });
    await new Promise((r) => setTimeout(r, 100));
    expect(await cancelRun(user, runId)).toBeTruthy();
    expect(await pending).toMatchObject({ status: "ignored" });
    expect((await runRow(runId)).status).toBe("cancelled");
    expect((await reportRow(report.id)).status).toBe("draft");
    expect(await t.db.select().from(envelopes).where(eq(envelopes.runId, runId))).toHaveLength(0);
  });

  it("forwards files as multipart inputs.file_N (VS-03)", async () => {
    setFileLoader(async () => ({
      files: [{ name: "title.pdf", mime: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.4 test") }],
      documents: [{ doc_ref: "file_1", file_name: "title.pdf", mime: "application/pdf", url: "https://example.invalid/f", expires_at: new Date().toISOString() }],
    }));
    const { runId } = await start();
    await executeRun(runId, { fetchImpl: mockFetch() });
    setFileLoader(async () => ({ documents: [], files: [] }));
    expect((await runRow(runId)).status).toBe("succeeded");
    expect(mockLog.at(-1)!.files[0]).toMatch(/^inputs.file_1:title.pdf:\d+$/);
  });
});

describe("starting runs (S-03, S-04)", () => {
  it("refuses incomplete intakes with the missing fields", async () => {
    const s = await setup();
    await saveReport(s.user, s.report.id, { intake: { "property.region": "NCR" } });
    const r = await startRun(s.user, s.report.id);
    expect(r).toMatchObject({ ok: false, status: 400, code: "INPUT_INVALID" });
    expect(!r.ok && r.issues!.map((i) => i.key)).toContain("qd.ask_psqm");
  });
  it("409 when the report already has a run in progress", async () => {
    const s = await setup();
    expect((await startRun(s.user, s.report.id)).ok).toBe(true);
    expect(await startRun(s.user, s.report.id)).toMatchObject({ ok: false, status: 409 });
  });
  it("429 RATE_LIMITED with two runs already in progress for the user", async () => {
    const s = await setup();
    const r2 = await createReport(s.user, "quick_report");
    await saveReport(s.user, r2.id, { intake: INTAKE });
    const r3 = await createReport(s.user, "quick_report");
    await saveReport(s.user, r3.id, { intake: INTAKE });
    expect((await startRun(s.user, s.report.id)).ok).toBe(true);
    expect((await startRun(s.user, r2.id)).ok).toBe(true);
    expect(await startRun(s.user, r3.id)).toMatchObject({ ok: false, status: 429, code: "RATE_LIMITED" });
  });
  it("status view: retry link, messages, and the stale-run safety net", async () => {
    const { user, runId } = await start("unavailable");
    await executeRun(runId, { fetchImpl: mockFetch() });
    const v = (await getRunStatus(user, runId))!;
    expect(v).toMatchObject({ status: "failed", errorCode: "VS_UNAVAILABLE" });
    expect(v.nextRunId).toBeTruthy();
    expect(v.retryAt).toBeTruthy();

    const s = await start();
    await t.db.update(runs).set({ status: "running", startedAt: new Date(Date.now() - 20 * 60_000) }).where(eq(runs.id, s.runId));
    const stale = (await getRunStatus(s.user, s.runId))!;
    expect(stale).toMatchObject({ status: "failed", errorCode: "VS_TIMEOUT", canRetry: true });
  });
  it("another user cannot read or cancel a run", async () => {
    const a = await start();
    const b = await setup();
    expect(await getRunStatus(b.user, a.runId)).toBeNull();
    expect(await cancelRun(b.user, a.runId)).toBeNull();
  });
});
