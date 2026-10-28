/**
 * Teaser Scan (BRD v2.0; Teaser design S-17/S-18): scan → needs confirmation → confirm creates the Quick
 * Report with listing_source → its run validates against quick_report 1.1.0 (TS-AC-02, 07, 08, 09).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { handleMockRequest, mockLog } from "@/mock/vectorshift/handler";
import { registerAccount } from "@/lib/auth/service";
import { createReport, saveReport } from "@/lib/reports/service";
import { executeRun, setFileLoader } from "@/lib/runs/worker";
import { startRun } from "@/lib/runs/service";
import { confirmTeaser } from "@/lib/teasers/service";
import { conflictGroups, prefill } from "@/lib/teasers/review";
import { latestEnvelopeForReport } from "@/lib/db/repos/runs";
import { reports } from "@/lib/db/schema";
import { validatePayload } from "@/lib/contract/validate";
import { buildRunRequest } from "@/lib/runs/run-request";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
process.env.RUN_DISPATCH = "none";
process.env.VECTORSHIFT_BASE_URL = "http://localhost:4010";
// These tests cover the BRD contract path (run_request in, result_envelope contract out).
process.env.VS_INPUT_QUICK_REPORT = "run_request";
process.env.VECTORSHIFT_API_KEY = "mock";
process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report";
process.env.VS_PIPELINE_TEASER_INTAKE = "mock-teaser_intake";
process.env.FEATURE_TEASER_SCAN = "true";

const mockFetch: typeof fetch = (input, init) => handleMockRequest(new Request(String(input), init), { delayMs: 0 });
let t: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  t = await createTestDb();
  setFileLoader(async () => ({ documents: [], files: [] }));
});
afterAll(async () => t.close());

async function scanned() {
  const r = await registerAccount({ username: `teaser_${Date.now() % 1e6}`, password: "mango lamp river seven", confirmPassword: "mango lamp river seven", acceptTerms: true, address: "10.6.0.1" });
  if (!r.ok) throw new Error("register");
  const report = await createReport(r.user, "teaser_intake");
  await saveReport(r.user, report.id, { intake: { ...report.intake, "teaser.pasted_text": "Commercial lot along C6 Taguig, 1.4 has, ₱42k/sqm", "teaser.relationship": "received_from_network", "teaser.consent": true } });
  const started = await startRun(r.user, report.id);
  if (!started.ok) throw new Error(JSON.stringify(started));
  expect(await executeRun(started.runId, { fetchImpl: mockFetch })).toMatchObject({ status: "succeeded" });
  return { user: r.user, teaserId: report.id };
}

describe("Teaser Scan", () => {
  it("a scan ends in 'needs confirmation' and creates no Quick Report until confirmed (TS-AC-08)", async () => {
    const { user, teaserId } = await scanned();
    const [row] = await t.db.select().from(reports).where(eq(reports.id, teaserId));
    expect(row!.status).toBe("needs_confirmation");
    const qrs = await t.db.select().from(reports).where(and(eq(reports.userId, user.id), eq(reports.product, "quick_report")));
    expect(qrs).toHaveLength(0);
    const sent = mockLog.at(-1)!;
    expect(sent.product).toBe("teaser_intake");
  });

  it("the scan sends the Quick Report's own options, so a new band needs no prompt change (TS-AC-07)", () => {
    const req = buildRunRequest({ product: "teaser_intake", reportId: "00000000-0000-4000-8000-000000000000", attempt: 1, intake: {}, complete: true, userPublicId: "U-ABC123", appOrigin: "http://localhost:3000" });
    const keys = req.field_dictionary.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["qd.lot_area", "qd.ask_psqm", "teaser.relationship"]));
  });

  it("confirm is refused while a conflict is open or required answers are missing (TS-AC-02)", async () => {
    const { user, teaserId } = await scanned();
    const env = await latestEnvelopeForReport(teaserId);
    const payload = (env!.envelope.envelope as { report: unknown }).report;
    const groups = conflictGroups(payload);
    expect(groups.map((g) => g.key)).toEqual(["lot_area"]);
    expect(groups[0]!.options.map((o) => o.key)).toEqual(["lot_area", "lot_area_post", "unconfirmed"]);
    const intake = { ...prefill(payload), "qd.comp_low": 30000, "qd.comp_high": 50000 };
    expect(await confirmTeaser(user, teaserId, { intake, resolutions: {} })).toMatchObject({ ok: false, code: "CONFLICTS_OPEN" });
    expect(await confirmTeaser(user, teaserId, { intake: prefill(payload), resolutions: { lot_area: "lot_area" } })).toMatchObject({ ok: false, code: "INPUT_INVALID" });
  });

  it("confirm creates the Quick Report with listing_source; its result validates against quick_report 1.1.0 (TS-AC-09)", async () => {
    const { user, teaserId } = await scanned();
    const env = await latestEnvelopeForReport(teaserId);
    const payload = (env!.envelope.envelope as { report: unknown }).report;
    const intake = { ...prefill(payload), "qd.comp_low": 30000, "qd.comp_high": 50000 };
    const r = await confirmTeaser(user, teaserId, { intake, resolutions: { lot_area: "lot_area" } });
    expect(r).toMatchObject({ ok: true });
    if (!r.ok || !r.runId) throw new Error("confirm");
    const [teaser] = await t.db.select().from(reports).where(eq(reports.id, teaserId));
    expect(teaser!.status).toBe("ready");
    expect(teaser!.intake["teaser.confirmed_report_id"]).toBe(r.reportId);
    expect(await confirmTeaser(user, teaserId, { intake, resolutions: { lot_area: "lot_area" } })).toMatchObject({ ok: false, status: 409 });

    expect(await executeRun(r.runId, { fetchImpl: mockFetch })).toMatchObject({ status: "succeeded" });
    const qrEnv = await latestEnvelopeForReport(r.reportId);
    const qr = (qrEnv!.envelope.envelope as { report: Record<string, unknown> }).report;
    expect(qr.listing_source).toMatchObject({ relationship: "received_from_network", broker_edited_fields: 0 });
    expect((qr.listing_source as { claims: unknown[] }).claims.length).toBeGreaterThan(0);
    expect(validatePayload("quick_report", qr).ok).toBe(true);
  });
});
