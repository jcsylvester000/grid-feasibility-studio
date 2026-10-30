import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../helpers/pglite";
import { handleMockRequest, mockLog } from "@/mock/vectorshift/handler";
import { registerAccount } from "@/lib/auth/service";
import { createReport, saveReport } from "@/lib/reports/service";
import { getReportForUser } from "@/lib/db/repos/reports";
import { executeRun } from "@/lib/runs/worker";
import { startRun } from "@/lib/runs/service";
import { carryOver, createFromSource, eligibleSources, sourceInfo } from "@/lib/reports/sources";
import { sourceAge, sourceRunKeys } from "@/lib/reports/source-age";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
process.env.RUN_DISPATCH = "none";
process.env.FEATURE_TOKENS = "false";
process.env.VECTORSHIFT_BASE_URL = "http://localhost:4010";
process.env.VS_INPUT_QUICK_REPORT = "run_request";
process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report";
process.env.VS_PIPELINE_EXECUTIVE_SUMMARY = "mock-executive_summary";
process.env.VS_PIPELINE_FEASIBILITY_REPORT = "mock-feasibility_report";

const QR = {
  "property.region": "NCR", "property.province": "Metro Manila", "property.city": "Taguig", "property.road_access": "major_road",
  "qd.lot_area": 15000, "qd.floor_area": 0, "use.goal": "sell", "owner.type": "developer_established",
  "qd.ask_psqm": 40000, "qd.comp_low": 30000, "qd.comp_high": 50000, "qd.comp_count": 8, "qd.zonal": 0, "qd.as_of": 0,
};
const mockFetch = (): typeof fetch => (input, init) => handleMockRequest(new Request(String(input), init), { delayMs: 0 });

let t: Awaited<ReturnType<typeof createTestDb>>;
let n = 0;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());

async function user() {
  n++;
  const r = await registerAccount({ username: `chain_${n}_${Date.now() % 1e5}`, password: "mango lamp river seven", confirmPassword: "mango lamp river seven", acceptTerms: true, address: `10.8.0.${n}` });
  if (!r.ok) throw new Error("register");
  return r.user;
}
async function finished(u: Awaited<ReturnType<typeof user>>, product: "quick_report" | "executive_summary", intake: Record<string, unknown>) {
  const rep = await createReport(u, product);
  await saveReport(u, rep.id, { intake: { ...rep.intake, ...intake } });
  const s = await startRun(u, rep.id);
  if (!s.ok) throw new Error(JSON.stringify(s));
  await executeRun(s.runId, { fetchImpl: mockFetch() });
  return rep;
}

describe("starting a report from a finished report", () => {
  it("lists only the user's finished reports that can feed the product", async () => {
    const u = await user();
    const other = await user();
    const qr = await finished(u, "quick_report", QR);
    await createReport(u, "quick_report"); // draft, never run: not offered
    await finished(other, "quick_report", QR);
    const forEs = await eligibleSources(u.id, "executive_summary");
    expect(forEs.map((s) => s.id)).toEqual([qr.id]);
    expect(forEs[0]).toMatchObject({ product: "quick_report", versions: 1 });
    expect((await eligibleSources(u.id, "feasibility_report")).map((s) => s.id)).toEqual([qr.id]);
    expect(await eligibleSources(u.id, "quick_report")).toEqual([]);
  });

  it("Quick Report → Executive Summary carries the answers, marks the band values approximate and suggests the land cost", async () => {
    const u = await user();
    const qr = await finished(u, "quick_report", QR);
    const r = await createFromSource(u, "executive_summary", qr.id);
    if (!r.ok) throw new Error(r.message);
    const es = (await getReportForUser(u.id, r.reportId))!;
    expect(es.product).toBe("executive_summary");
    expect(es.title).toContain("(from Quick Report)");
    expect(es.intake).toMatchObject({
      "property.city": "Taguig", "property.road_access": "major_road", "property.lot_area": 15000, "use.goal": "sell", "owner.type": "developer_established",
      "market.asking_low": 30000, "market.asking_high": 50000, "market.comps_count": 8, "fin.land_cost": 600_000_000,
      "source.report_id": qr.id, "source.product": "quick_report", "source.title": qr.title,
    });
    expect(es.intake["market.zonal_per_sqm"]).toBeUndefined(); // "Not checked yet" is not carried
    expect(es.intake["property.floor_area"]).toBeUndefined(); // raw land
    expect(es.intake["source.approx"]).toEqual({ "property.lot_area": 15000, "market.asking_low": 30000, "market.asking_high": 50000, "market.comps_count": 8, "fin.land_cost": 600_000_000 });
    const info = await sourceInfo(u.id, es.intake);
    expect(info).toMatchObject({ productName: "Quick Report", reuse: true, ageDays: 0, exists: true });
    expect(info!.carried).toBeGreaterThanOrEqual(10);
  });

  it("the Executive Summary run sends the source link and the reuse flag to the pipeline", async () => {
    const u = await user();
    const qr = await finished(u, "quick_report", QR);
    const r = await createFromSource(u, "executive_summary", qr.id);
    if (!r.ok) throw new Error(r.message);
    await saveReport(u, r.reportId, { intake: { ...(await getReportForUser(u.id, r.reportId))!.intake, "use.intended_use": "residential_condominium" } });
    const s = await startRun(u, r.reportId);
    if (!s.ok) throw new Error(JSON.stringify(s));
    await executeRun(s.runId, { fetchImpl: mockFetch() });
    const entry = mockLog.filter((e) => e.reportId === r.reportId).at(-1)!;
    expect(entry.source).toMatchObject({ "source.report_id": qr.id, "source.product": "quick_report", "source.reuse_research": true, "source.age_days": 0 });
  });

  it("Executive Summary → Feasibility Report carries the answers and switches on the cost section when costs exist", async () => {
    const u = await user();
    const qr = await finished(u, "quick_report", QR);
    const first = await createFromSource(u, "executive_summary", qr.id);
    if (!first.ok) throw new Error(first.message);
    const esDraft = (await getReportForUser(u.id, first.reportId))!;
    await saveReport(u, esDraft.id, { intake: { ...esDraft.intake, "use.intended_use": "residential_condominium", "fin.build_cost": 1_200_000_000, "property.lot_area": 15234 } });
    const s = await startRun(u, esDraft.id);
    if (!s.ok) throw new Error(JSON.stringify(s));
    await executeRun(s.runId, { fetchImpl: mockFetch() });

    const r = await createFromSource(u, "feasibility_report", esDraft.id);
    if (!r.ok) throw new Error(r.message);
    const fr = (await getReportForUser(u.id, r.reportId))!;
    expect(fr.intake).toMatchObject({ toc_mode: "summary_first", "use.intended_use": "residential_condominium", "fin.build_cost": 1_200_000_000, "fin.enabled": true, "property.lot_area": 15234, "source.product": "executive_summary" });
    // The user replaced the lot area with an exact figure, so it is no longer approximate; the rest still are.
    expect(fr.intake["source.approx"]).not.toHaveProperty("property.lot_area");
    expect(fr.intake["source.approx"]).toHaveProperty("market.asking_low", 30000);
  });

  it("Quick Report → Feasibility Report works directly", async () => {
    const u = await user();
    const qr = await finished(u, "quick_report", QR);
    const r = await createFromSource(u, "feasibility_report", qr.id);
    expect(r.ok).toBe(true);
  });

  it("refuses drafts, the wrong product and other users' reports", async () => {
    const u = await user();
    const other = await user();
    const draft = await createReport(u, "quick_report");
    expect(await createFromSource(u, "executive_summary", draft.id)).toMatchObject({ ok: false, code: "NO_RESULT" });
    const theirs = await finished(other, "quick_report", QR);
    expect(await createFromSource(u, "executive_summary", theirs.id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const qr = await finished(u, "quick_report", QR);
    expect(await createFromSource(u, "quick_report", qr.id)).toMatchObject({ ok: false, code: "NOT_A_SOURCE" });
  });

  it("research is reused for 30 days, then refreshed", () => {
    const now = new Date("2026-10-30T00:00:00Z");
    const at = (days: number) => ({ "source.finished_at": new Date(now.getTime() - days * 86_400_000).toISOString() });
    expect(sourceAge(at(30), now)).toMatchObject({ days: 30, reuse: true });
    expect(sourceAge(at(31), now)).toMatchObject({ days: 31, reuse: false });
    expect(sourceRunKeys(at(31), now)).toEqual({ "source.age_days": 31, "source.reuse_research": false });
    expect(sourceRunKeys({}, now)).toEqual({});
  });

  it("carryOver ignores answers that were not given", () => {
    expect(carryOver("quick_report", { "property.city": "Taguig" }, "executive_summary")).toEqual({ intake: { "property.city": "Taguig" }, approx: {} });
  });
});
