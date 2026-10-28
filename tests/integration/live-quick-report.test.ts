/**
 * Live Quick Report pipeline (VectorShift, Oct 2026): 21 named text inputs, output in the pipeline's own
 * format, input snapshots per run, versions that are never overwritten, and dispatch on Netlify.
 */
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { registerAccount } from "@/lib/auth/service";
import { createReport, saveReport } from "@/lib/reports/service";
import { executeRun } from "@/lib/runs/worker";
import { startRun } from "@/lib/runs/service";
import { envelopeForReportRun, latestEnvelopeForReport } from "@/lib/db/repos/runs";
import { envelopes, reports, runs } from "@/lib/db/schema";
import { fieldDictionary } from "@/lib/options";
import { QR_PIPELINE_INPUTS, quickReportInputs, quickReportRef } from "@/lib/vectorshift/quick-report-fields";
import { normaliseLive, parseJsonLoose, parseLiveOutputs, QR_LIVE_FORMAT } from "@/lib/vectorshift/quick-report-live";
import { reportVersions } from "@/lib/reports/versions";
import { dispatchMode, dispatchRun } from "@/lib/runs/dispatch";
import { handleMockRequest } from "@/mock/vectorshift/handler";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";
process.env.RUN_DISPATCH = "none";
process.env.VECTORSHIFT_BASE_URL = "https://api.vectorshift.ai";
process.env.VECTORSHIFT_API_KEY = "sk_test_not_a_real_key";
process.env.VS_PIPELINE_QUICK_REPORT = "6adefcd965509b4158a2f6de";
delete process.env.VS_INPUT_QUICK_REPORT;

const SAMPLE = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/live-quick-report-sample.json`, "utf8"));
const SAMPLE_INPUTS = SAMPLE.quick_report_inputs as Record<string, string | null>;

/** The intake whose dropdown labels are the sample's inputs (reverse lookup through the field dictionary). */
function intakeFromLabels(labels: Record<string, string | null>) {
  const dict = fieldDictionary("quick_report");
  const intake: Record<string, unknown> = {};
  for (const [name, key] of QR_PIPELINE_INPUTS) {
    const label = labels[name];
    if (!key || !label) continue;
    const entry = dict.find((f) => f.key === key);
    const opt = entry?.options?.find((o) => o.label === label);
    intake[key] = opt ? opt.value : label;
  }
  return intake;
}
const INTAKE = intakeFromLabels(SAMPLE_INPUTS);
// The sample's ₱42,000 is not one of the app's asking-price options; runs use the nearest option.
const RUN_INTAKE = { ...INTAKE, "qd.ask_psqm": 45000 };

let t: Awaited<ReturnType<typeof createTestDb>>;
let n = 0;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());
afterEach(() => {
  process.env.RUN_DISPATCH = "none";
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  delete process.env.NETLIFY;
});

async function setup(intake: Record<string, unknown> = RUN_INTAKE) {
  n++;
  const r = await registerAccount({ username: `live_${n}_${Date.now() % 1e5}`, password: "mango lamp river seven", confirmPassword: "mango lamp river seven", acceptTerms: true, address: `10.9.0.${n}` });
  if (!r.ok) throw new Error("register");
  const report = await createReport(r.user, "quick_report");
  await saveReport(r.user, report.id, { intake });
  return { user: r.user, report };
}

/** A fetch that answers like VectorShift and records what it was sent. */
function vectorShiftStub(outputs: Record<string, unknown> | (() => Response)) {
  const calls: { url: string; headers: Headers; body: unknown }[] = [];
  const impl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    if (typeof outputs === "function") return outputs();
    return new Response(JSON.stringify({ status: "success", run_id: "vs_run_123", outputs }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { impl, calls };
}

const sampleOutputs = (env: unknown = SAMPLE) => ({
  result_envelope: "```json\n" + JSON.stringify(env) + "\n```",
  Q01_tag_and_range_cost: "0.0123",
  Q06_one_page_writer_cost: "0.0456",
  Q07_qa_cost: "0.0078",
  Q08__Publish_cost: "0",
});

describe("inputs for the live Quick Report pipeline", () => {
  it("sends the 21 named inputs as the dropdown text the user saw", () => {
    const sent = quickReportInputs(INTAKE, { reportRef: "QR-20261028-C6TEST", today: "2026-10-28" });
    expect(Object.keys(sent).sort()).toEqual(QR_PIPELINE_INPUTS.map(([k]) => k).sort());
    expect(Object.keys(sent)).toHaveLength(21);
    for (const [name] of QR_PIPELINE_INPUTS) {
      if (name === "current_rent") expect(sent[name]).toBe("");
      else expect(sent[name]).toBe(SAMPLE_INPUTS[name]);
    }
  });

  it("builds a short report reference from the report id and date", () => {
    expect(quickReportRef("7fef3e98-ce4b-442b-83ce-c639a780ae8e", "2026-10-28")).toBe("QR-20261028-7FEF3E98");
  });
});

describe("output of the live Quick Report pipeline", () => {
  it("reads the sample output: rating, metrics, checks, snapshot, sources and QA", () => {
    const p = parseLiveOutputs(sampleOutputs());
    expect(p.ok && p.kind).toBe("live");
    if (!p.ok || p.kind !== "live") return;
    expect(p.result.rating).toMatchObject({ rating: "marginal", confidence: "medium", evidenceScore: 4 });
    expect(p.result.metrics).toHaveLength(7);
    expect(p.result.checks.map((c) => c.key)).toEqual(["zonal_not_checked", "snapshot_comps"]);
    expect(p.result.snapshot.map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4"]);
    expect(p.result.sources).toHaveLength(15);
    expect(p.result.draft).toBe("");
    expect(p.result.qa).toContain("QA status");
    expect(p.costs).toEqual({ Q01_tag_and_range_cost: "0.0123", Q06_one_page_writer_cost: "0.0456", Q07_qa_cost: "0.0078", Q08__Publish_cost: "0" });
  });

  it("tolerates fences and a leading json label, and rejects unusable output", () => {
    expect(parseJsonLoose('json{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonLoose("Here it is: {\"a\":2} thanks")).toEqual({ a: 2 });
    expect(parseLiveOutputs({}).ok).toBe(false);
    expect(parseLiveOutputs({ result_envelope: "{ not json" })).toMatchObject({ ok: false, code: "SCHEMA_INVALID" });
    expect(parseLiveOutputs({ result_envelope: JSON.stringify({ rating: { rating: "excellent" } }) })).toMatchObject({ ok: false, code: "SCHEMA_INVALID" });
    expect(normaliseLive({ rating: { rating: "Cannot tell" } }).ok).toBe(true);
  });

  it("still accepts a contract envelope if the pipeline returns one", () => {
    const p = parseLiveOutputs({ result_envelope: JSON.stringify({ schema_version: "1.0.0", report: {}, run: {} }) });
    expect(p.ok && p.kind).toBe("contract");
  });
});

describe("live runs, input snapshots and versions", () => {
  it("calls VectorShift with the key, the pipeline id and the named inputs, and stores the output", async () => {
    const s = await setup();
    const started = await startRun(s.user, s.report.id);
    if (!started.ok) throw new Error(JSON.stringify(started));
    const vs = vectorShiftStub(sampleOutputs());
    expect(await executeRun(started.runId, { fetchImpl: vs.impl })).toMatchObject({ status: "succeeded" });

    expect(vs.calls).toHaveLength(1);
    expect(vs.calls[0]!.url).toBe("https://api.vectorshift.ai/v1/pipeline/6adefcd965509b4158a2f6de/run");
    expect(vs.calls[0]!.headers.get("authorization")).toBe("Bearer sk_test_not_a_real_key");
    expect(vs.calls[0]!.headers.get("content-type")).toBe("application/json");
    const inputs = (vs.calls[0]!.body as { inputs: Record<string, string> }).inputs;
    expect(inputs.asking_price_per_sqm).toBe("₱45,000 per sqm");
    expect(inputs.comparable_lowest).toBe("₱20,000 per sqm");
    expect(inputs.report_id).toMatch(/^QR-\d{8}-[0-9A-F]{8}$/);

    const [run] = await t.db.select().from(runs).where(eq(runs.id, started.runId));
    expect(run!.inputSnapshot).toMatchObject({ mode: "fields", report_ref: inputs.report_id, sent: inputs });
    expect(run!.inputSnapshot!.intake).toMatchObject(RUN_INTAKE);
    const [env] = await t.db.select().from(envelopes).where(eq(envelopes.runId, started.runId));
    expect(env!.schemaVersion).toBe("vs_quick_report/1");
    expect(env!.envelope).toMatchObject({ format: QR_LIVE_FORMAT, vs_run_id: "vs_run_123", costs: { Q07_qa_cost: "0.0078" } });
    const [rep] = await t.db.select().from(reports).where(eq(reports.id, s.report.id));
    expect(rep!.status).toBe("ready");
  });

  it("running again with edited answers adds version 2 and keeps version 1 with its own inputs", async () => {
    const s = await setup();
    const first = await startRun(s.user, s.report.id);
    if (!first.ok) throw new Error("start 1");
    await executeRun(first.runId, { fetchImpl: vectorShiftStub(sampleOutputs()).impl });

    await saveReport(s.user, s.report.id, { intake: { ...RUN_INTAKE, "qd.ask_psqm": 60000 } });
    const second = await startRun(s.user, s.report.id);
    if (!second.ok) throw new Error("start 2");
    const vs2 = vectorShiftStub(sampleOutputs({ ...SAMPLE, rating: { ...SAMPLE.rating, rating: "weak", label: "Weak - priced above the market" } }));
    await executeRun(second.runId, { fetchImpl: vs2.impl });
    expect((vs2.calls[0]!.body as { inputs: Record<string, string> }).inputs.asking_price_per_sqm).toBe("₱60,000 per sqm");

    const versions = await reportVersions(s.report.id, "quick_report");
    expect(versions.map((v) => v.number)).toEqual([2, 1]);
    const v1 = versions.find((v) => v.number === 1)!;
    const v2 = versions.find((v) => v.number === 2)!;
    expect(v1.inputs!.find((i) => i.key === "qd.ask_psqm")!.value).toBe("₱45,000 per sqm");
    expect(v2.inputs!.find((i) => i.key === "qd.ask_psqm")!.value).toBe("₱60,000 per sqm");
    expect((await envelopeForReportRun(s.report.id, first.runId))?.run.id).toBe(first.runId);
    expect((await latestEnvelopeForReport(s.report.id))?.run.id).toBe(second.runId);
  });

  it("a failed re-run keeps the last successful version as the latest", async () => {
    const s = await setup();
    const first = await startRun(s.user, s.report.id);
    if (!first.ok) throw new Error("start");
    await executeRun(first.runId, { fetchImpl: vectorShiftStub(sampleOutputs()).impl });
    const again = await startRun(s.user, s.report.id);
    if (!again.ok) throw new Error("again");
    await executeRun(again.runId, { fetchImpl: vectorShiftStub(() => new Response(JSON.stringify({ status: "failed", error: "boom" }), { status: 500 })).impl });
    expect((await latestEnvelopeForReport(s.report.id))?.run.id).toBe(first.runId);
    const versions = await reportVersions(s.report.id, "quick_report");
    expect(versions[0]).toMatchObject({ number: null, status: "failed" });
    expect(versions[1]).toMatchObject({ number: 1, status: "succeeded" });
  });

  it("works end to end against the mock in the live format", async () => {
    process.env.VECTORSHIFT_BASE_URL = "http://localhost:4010";
    process.env.VS_PIPELINE_QUICK_REPORT = "mock-quick_report";
    try {
      const s = await setup();
      const started = await startRun(s.user, s.report.id);
      if (!started.ok) throw new Error("start");
      const mock: typeof fetch = (input, init) => handleMockRequest(new Request(String(input), init), { delayMs: 0 });
      expect(await executeRun(started.runId, { fetchImpl: mock })).toMatchObject({ status: "succeeded" });
      const env = await latestEnvelopeForReport(s.report.id);
      const p = normaliseLive((env!.envelope.envelope as { result: unknown }).result);
      expect(p.ok && p.value.rating.rating).toBe("marginal");
    } finally {
      process.env.VECTORSHIFT_BASE_URL = "https://api.vectorshift.ai";
      process.env.VS_PIPELINE_QUICK_REPORT = "6adefcd965509b4158a2f6de";
    }
  });
});

describe("dispatch on Netlify (runs never wait inside a 26-30 second function)", () => {
  it("defaults to the background function on Netlify and inline elsewhere; RUN_DISPATCH wins", () => {
    delete process.env.RUN_DISPATCH;
    expect(dispatchMode()).toBe("inline");
    process.env.AWS_LAMBDA_FUNCTION_NAME = "___netlify-server-handler";
    expect(dispatchMode()).toBe("netlify");
    process.env.RUN_DISPATCH = "inline";
    expect(dispatchMode()).toBe("inline");
  });

  it("calls the background function on the address the request came in on", async () => {
    process.env.RUN_DISPATCH = "netlify";
    process.env.INTERNAL_DISPATCH_SECRET = "secret-for-test";
    process.env.APP_ORIGIN = "http://localhost:3000";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 202 }));
    try {
      await dispatchRun("run-1", { origin: "https://grid-feasibility-studio-demo.netlify.app" });
      expect(String(spy.mock.calls[0]![0])).toBe("https://grid-feasibility-studio-demo.netlify.app/.netlify/functions/run-worker");
    } finally {
      spy.mockRestore();
    }
  });
});
