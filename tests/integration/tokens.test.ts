import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { handleMockRequest } from "@/mock/vectorshift/handler";
import { registerAccount } from "@/lib/auth/service";
import { createReport, saveReport } from "@/lib/reports/service";
import { executeRun } from "@/lib/runs/worker";
import { cancelRun, startRun } from "@/lib/runs/service";
import { getBalance, listLedger, topUpTokens } from "@/lib/db/repos/tokens";
import { runs, tokenLedger, tokenWallets } from "@/lib/db/schema";
import { tokenCost } from "@/lib/tokens/config";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
process.env.RUN_DISPATCH = "none";
process.env.VECTORSHIFT_BASE_URL = "http://localhost:4010";
process.env.VS_INPUT_QUICK_REPORT = "run_request";
process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report";
process.env.VS_PIPELINE_EXECUTIVE_SUMMARY = "mock-executive_summary";

const INTAKE = {
  "property.region": "NCR", "property.province": "Metro Manila", "property.city": "Taguig",
  "qd.lot_area": 15000, "qd.ask_psqm": 40000, "qd.comp_low": 30000, "qd.comp_high": 50000,
};
const mockFetch = (): typeof fetch => (input, init) => handleMockRequest(new Request(String(input), init), { delayMs: 0 });

let t: Awaited<ReturnType<typeof createTestDb>>;
let n = 0;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());
afterEach(() => {
  process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report";
  delete process.env.FEATURE_TOKENS;
});

async function account() {
  n++;
  const r = await registerAccount({ username: `wallet_${n}_${Date.now() % 1e5}`, password: "mango lamp river seven", confirmPassword: "mango lamp river seven", acceptTerms: true, address: `10.9.0.${n}` });
  if (!r.ok) throw new Error("register");
  return r.user;
}
async function report(user: Awaited<ReturnType<typeof account>>) {
  const rep = await createReport(user, "quick_report");
  await saveReport(user, rep.id, { intake: INTAKE });
  return rep;
}
const setBalance = (userId: string, balance: number) => t.db.update(tokenWallets).set({ balance }).where(eq(tokenWallets.userId, userId));

describe("GRID Token wallet", () => {
  it("opens every wallet with 100 tokens", async () => {
    const u = await account();
    expect(await getBalance(u.id)).toBe(100);
    const ledger = await listLedger(u.id);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ kind: "opening", delta: 100, balanceAfter: 100 });
  });

  it("a Quick Report uses 30 tokens; the charge is on the run and in the ledger", async () => {
    const u = await account();
    const rep = await report(u);
    const s = await startRun(u, rep.id);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(await getBalance(u.id)).toBe(70);
    const [run] = await t.db.select().from(runs).where(eq(runs.id, s.runId));
    expect(run!.chargeId).toBeTruthy();
    const [charge] = await listLedger(u.id, 1);
    expect(charge).toMatchObject({ kind: "charge", delta: -30, balanceAfter: 70, product: "quick_report", reportId: rep.id, runId: s.runId });
    await executeRun(s.runId, { fetchImpl: mockFetch() });
    expect(await getBalance(u.id)).toBe(70); // success keeps the charge
  });

  it("prices: Quick Report 30, Executive Summary 50, Feasibility Report 100; a price can be overridden", () => {
    expect(tokenCost("quick_report")).toBe(30);
    expect(tokenCost("executive_summary")).toBe(50);
    expect(tokenCost("feasibility_report")).toBe(100);
    for (const p of ["teaser_intake", "market_insight"]) expect(tokenCost(p)).toBe(0);
    process.env.TOKENS_COST_EXECUTIVE_SUMMARY = "60";
    try {
      expect(tokenCost("executive_summary")).toBe(60);
    } finally {
      delete process.env.TOKENS_COST_EXECUTIVE_SUMMARY;
    }
  });

  it("refuses with 402 when the balance is below the cost, and starts nothing", async () => {
    const u = await account();
    await getBalance(u.id);
    await setBalance(u.id, 2);
    const rep = await report(u);
    const s = await startRun(u, rep.id);
    expect(s).toMatchObject({ ok: false, status: 402, code: "INSUFFICIENT_TOKENS" });
    if (!s.ok) expect(s.message).not.toMatch(/php|₱/i);
    expect(await t.db.select().from(runs).where(eq(runs.reportId, rep.id))).toHaveLength(0);
    expect(await getBalance(u.id)).toBe(2);
  });

  it("allows a run that uses the last tokens exactly", async () => {
    const u = await account();
    await getBalance(u.id);
    await setBalance(u.id, 30);
    const s = await startRun(u, (await report(u)).id);
    expect(s.ok).toBe(true);
    expect(await getBalance(u.id)).toBe(0);
  });

  it("concurrent starts never overdraw the wallet", async () => {
    const u = await account();
    await getBalance(u.id);
    await setBalance(u.id, 50);
    const reps = await Promise.all([report(u), report(u), report(u)]);
    const results = await Promise.all(reps.map((r) => startRun(u, r.id)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await getBalance(u.id)).toBe(20);
  });

  it("returns the tokens once when the report fails, including after the automatic retry", async () => {
    const u = await account();
    process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report--unavailable";
    const rep = await report(u);
    const s = await startRun(u, rep.id);
    if (!s.ok) throw new Error("start");
    await executeRun(s.runId, { fetchImpl: mockFetch() });
    expect(await getBalance(u.id)).toBe(70); // retry queued: still charged
    const retry = (await t.db.select().from(runs).where(eq(runs.reportId, rep.id))).find((r) => r.attempt === 2)!;
    expect(retry.chargeId).toBeTruthy();
    await executeRun(retry.id, { fetchImpl: mockFetch() });
    expect(await getBalance(u.id)).toBe(100);
    const refunds = (await listLedger(u.id)).filter((e) => e.kind === "refund");
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ delta: 30, balanceAfter: 100 });
  });

  it("returns the tokens when a non-retryable failure ends the run", async () => {
    const u = await account();
    process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report--bad_request";
    const s = await startRun(u, (await report(u)).id);
    if (!s.ok) throw new Error("start");
    await executeRun(s.runId, { fetchImpl: mockFetch() });
    expect(await getBalance(u.id)).toBe(100);
  });

  it("returns the tokens when the user cancels, and only once", async () => {
    const u = await account();
    const s = await startRun(u, (await report(u)).id);
    if (!s.ok) throw new Error("start");
    expect(await cancelRun(u, s.runId)).toBeTruthy();
    await cancelRun(u, s.runId);
    expect(await getBalance(u.id)).toBe(100);
    const rows = await t.db.select().from(tokenLedger).where(eq(tokenLedger.userId, u.id));
    expect(rows.filter((r) => r.kind === "refund")).toHaveLength(1);
  });

  it("FEATURE_TOKENS=false switches charging off", async () => {
    process.env.FEATURE_TOKENS = "false";
    const u = await account();
    const s = await startRun(u, (await report(u)).id);
    expect(s.ok).toBe(true);
    expect(await getBalance(u.id)).toBe(100);
  });

  it("demo top-up adds tokens up to the cap", async () => {
    const u = await account();
    expect(await topUpTokens(u.id, 100)).toBe(200);
    await setBalance(u.id, 950);
    expect(await topUpTokens(u.id, 100)).toBe(1000);
    expect(await topUpTokens(u.id, 100)).toBe(1000);
  });
});

describe("one pipeline call per Generate on the live VectorShift API", () => {
  it("does not retry automatically when the live pipeline is unavailable, and returns the tokens", async () => {
    const u = await account();
    process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report--unavailable";
    process.env.VS_BASE_URL_QUICK_REPORT = "https://api.vectorshift.ai";
    process.env.VECTORSHIFT_API_KEY = "test-key-not-real";
    const calls: string[] = [];
    const counting: typeof fetch = (input, init) => {
      calls.push(String(input));
      return handleMockRequest(new Request(String(input).replace("https://api.vectorshift.ai", "http://localhost:4010"), init), { delayMs: 0 });
    };
    try {
      const rep = await report(u);
      const s = await startRun(u, rep.id);
      if (!s.ok) throw new Error("start");
      await executeRun(s.runId, { fetchImpl: counting });
      expect(calls).toHaveLength(1);
      expect(await t.db.select().from(runs).where(eq(runs.reportId, rep.id))).toHaveLength(1);
      expect(await getBalance(u.id)).toBe(100);
      // A second worker for the same run (duplicate dispatch, platform retry) does nothing.
      expect(await executeRun(s.runId, { fetchImpl: counting })).toMatchObject({ claimed: false });
      expect(calls).toHaveLength(1);
    } finally {
      delete process.env.VS_BASE_URL_QUICK_REPORT;
      delete process.env.VECTORSHIFT_API_KEY;
    }
  });

  it("refuses a second start while a run of the same report is active", async () => {
    const u = await account();
    const rep = await report(u);
    const [a, b] = await Promise.all([startRun(u, rep.id), startRun(u, rep.id)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(await getBalance(u.id)).toBe(70); // charged once
  });
});
