/**
 * B9-05 load test against the mock: 50 users start a run within one minute. The global limit
 * (VS_MAX_CONCURRENT) and the per-user limit are respected, refusals are 429 RATE_LIMITED with a plain
 * message (never an error), and every accepted run finishes.
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDb } from "../helpers/pglite";
import { handleMockRequest } from "@/mock/vectorshift/handler";
import { registerAccount } from "@/lib/auth/service";
import { createReport, saveReport } from "@/lib/reports/service";
import { startRun } from "@/lib/runs/service";
import { executeRun } from "@/lib/runs/worker";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
process.env.RUN_DISPATCH = "none";
process.env.VECTORSHIFT_BASE_URL = "http://localhost:4010";
process.env.VECTORSHIFT_API_KEY = "mock";
process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report";
process.env.VS_MAX_CONCURRENT = "10";

const INTAKE = { "property.region": "NCR", "property.province": "Metro Manila", "property.city": "Taguig", "qd.lot_area": 15000, "qd.ask_psqm": 40000, "qd.comp_low": 30000, "qd.comp_high": 50000 };
const mockFetch: typeof fetch = (input, init) => handleMockRequest(new Request(String(input), init), { delayMs: 50 });
let t: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  delete process.env.VS_MAX_CONCURRENT;
  await t.close();
});

it("50 users starting runs at once: 10 run, 40 get a polite 429, all accepted runs succeed; the next wave runs", async () => {
  const users = await Promise.all(
    Array.from({ length: 50 }, async (_, i) => {
      const r = await registerAccount({ username: `load_${i}_${Date.now() % 1e5}`, password: "mango lamp river seven", confirmPassword: "mango lamp river seven", acceptTerms: true, address: `10.4.${Math.floor(i / 4)}.${i}` });
      if (!r.ok) throw new Error(`register ${i}: ${JSON.stringify(r)}`);
      const report = await createReport(r.user, "quick_report");
      await saveReport(r.user, report.id, { intake: INTAKE });
      return { user: r.user, reportId: report.id };
    }),
  );
  const started = Date.now();
  const results = await Promise.all(users.map((u) => startRun(u.user, u.reportId)));
  const accepted = results.filter((r) => r.ok);
  const refused = results.filter((r) => !r.ok);
  expect(accepted).toHaveLength(10); // the limit holds under a burst (checked inside the transaction)
  for (const r of refused) expect(r).toMatchObject({ status: 429, code: "RATE_LIMITED" });

  const done = await Promise.all(accepted.map((r) => (r.ok ? executeRun(r.runId, { fetchImpl: mockFetch }) : null)));
  expect(done.every((d) => d && d.claimed && d.status === "succeeded")).toBe(true);

  // Second wave: the refused users try again once slots are free.
  const waiting = users.filter((_, i) => !results[i]!.ok).slice(0, 10);
  const wave2 = await Promise.all(waiting.map((u) => startRun(u.user, u.reportId)));
  expect(wave2.filter((r) => r.ok).length).toBeGreaterThan(0);
  expect(Date.now() - started).toBeLessThan(60_000);
}, 120_000);
