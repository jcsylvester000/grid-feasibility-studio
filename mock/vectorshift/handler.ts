/**
 * Mock VectorShift pipelines API (VS-12). Same URL shape as the real service:
 *   POST /v1/pipeline/{pipelineId}/run   (Authorization: Bearer <any key>)
 * Body: JSON { inputs: { run_request } } or multipart/form-data with `inputs` (JSON string) and
 * file fields `inputs.file_1` ... `inputs.file_10`.
 *
 * Pipeline ids: "mock-<product>" or "mock-<product>--<scenario>". Scenarios:
 *   success (default) · failed · bad_request · auth · server_error · unavailable · timeout
 *   missing_output · invalid_json · schema_invalid · envelope_failed · slow
 * Tests: POST /__control/{reportId} { scenario } forces a scenario for one report; DELETE clears it.
 * Env: MOCK_VS_DELAY_MS (default 2500) adds a delay to every run; MOCK_VS_SCENARIO forces a scenario.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildEnvelope } from "../../lib/contract/envelope";
import { prototypePayload } from "../../lib/demo/engine";
import type { Product } from "../../lib/db/schema";

const PRODUCTS: Product[] = ["quick_report", "executive_summary", "feasibility_report", "teaser_intake"];
const payloadCache = new Map<Product, Record<string, unknown>>();

function goldenPayload(product: Product, reportId: string) {
  if (!payloadCache.has(product)) {
    const file = path.join(process.cwd(), "mock/vectorshift/payloads", `${product}.json`);
    payloadCache.set(product, JSON.parse(readFileSync(file, "utf8")));
  }
  const copy = structuredClone(payloadCache.get(product)!);
  const meta = copy.meta as Record<string, unknown>;
  if (product !== "teaser_intake") meta.report_id = reportId;
  return copy;
}

/**
 * MOCK_VS_PAYLOADS=prototype (the default for `npm run mock:vs`): reports are built from the run's own
 * inputs by GRID's prototype engine (lib/demo/engine.ts), so demos show input-specific results.
 * Otherwise (tests): the C6 Calzada-Tipas golden payloads.
 */
function stubPayload(product: Product, reportId: string, intake: Record<string, unknown>) {
  if (process.env.MOCK_VS_PAYLOADS === "prototype" && product !== "teaser_intake") {
    try {
      return prototypePayload(product, intake, { reportId });
    } catch (err) {
      console.error("prototype engine failed; using the golden payload:", err instanceof Error ? err.message : err);
    }
  }
  return goldenPayload(product, reportId);
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Per-report scenario overrides for end-to-end tests: POST /__control/{reportId} { scenario }. */
const overrides = new Map<string, string>();

export type MockLogEntry = { pipelineId: string; scenario: string; product?: string; reportId?: string; files: string[]; documents?: string[]; at: string };
export const mockLog: MockLogEntry[] = [];

export async function handleMockRequest(req: Request, opts: { delayMs?: number } = {}): Promise<Response> {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/v1\/pipeline\/([^/]+)\/run$/);
  if (req.method === "GET" && url.pathname === "/health") return json(200, { ok: true });
  // Tests: GET /__log?reportId=... returns what the mock received (file names and sizes, document refs).
  if (req.method === "GET" && url.pathname === "/__log") {
    const id = url.searchParams.get("reportId");
    return json(200, { entries: mockLog.filter((e) => !id || e.reportId === id) });
  }
  const control = url.pathname.match(/^\/__control\/([^/]+)$/);
  if (control) {
    if (req.method === "DELETE") overrides.delete(control[1]!);
    else overrides.set(control[1]!, String(((await req.json().catch(() => ({}))) as { scenario?: string }).scenario ?? "success"));
    return json(200, { ok: true, overrides: Object.fromEntries(overrides) });
  }
  if (req.method !== "POST" || !match) return json(404, { error: "Not found" });

  const pipelineId = decodeURIComponent(match[1]!);
  const [base, suffix] = pipelineId.split("--");
  let scenario = process.env.MOCK_VS_SCENARIO || suffix || "success";
  const product = base?.replace(/^mock-/, "") as Product;

  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/.test(auth)) return json(401, { error: "Invalid API key" });
  if (!PRODUCTS.includes(product)) return json(400, { status: "failed", error: `Unknown pipeline ${pipelineId}` });

  // Read inputs (JSON or multipart).
  let inputs: Record<string, unknown> = {};
  const files: string[] = [];
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      inputs = JSON.parse(String(form.get("inputs") ?? "{}"));
      for (const [k, v] of form.entries()) if (k.startsWith("inputs.file_") && typeof v !== "string") files.push(`${k}:${v.name}:${v.size}`);
    } else {
      inputs = ((await req.json()) as { inputs?: Record<string, unknown> }).inputs ?? {};
    }
  } catch {
    return json(400, { status: "failed", error: "Malformed request body" });
  }
  let runRequest: { report_id?: string; product?: string; documents?: { doc_ref: string; capability?: string }[]; intake?: Record<string, unknown> };
  try {
    runRequest = JSON.parse(String(inputs.run_request ?? ""));
  } catch {
    return json(400, { status: "failed", error: "Input run_request is missing or not JSON" });
  }
  const override = runRequest.report_id ? overrides.get(runRequest.report_id) : undefined;
  if (override) scenario = override;
  mockLog.push({ pipelineId, scenario, product: runRequest.product, reportId: runRequest.report_id, files, documents: (runRequest.documents ?? []).map((d) => `${d.doc_ref}:${d.capability ?? ""}`), at: new Date().toISOString() });

  const delay = opts.delayMs ?? Number(process.env.MOCK_VS_DELAY_MS ?? 2500);
  await sleep(scenario === "slow" ? delay * 10 : delay);

  if (scenario === "auth") return json(401, { error: "Invalid API key" });
  const reportId = runRequest.report_id ?? "unknown";
  const runId = `mockrun_${Date.now().toString(36)}`;
  switch (scenario) {
    case "bad_request":
      return json(400, { status: "failed", error: "Input names do not match the pipeline" });
    case "server_error":
      return json(500, { status: "failed", error: "Internal pipeline error" });
    case "unavailable":
      return json(503, { error: "Service unavailable" });
    case "timeout":
      await sleep(15 * 60 * 1000);
      return json(504, { error: "Gateway timeout" });
    case "failed":
      return json(200, { status: "failed", run_id: runId, error: "Pipeline step N05 failed" });
    case "missing_output":
      return json(200, { status: "success", run_id: runId, outputs: { something_else: "x" } });
    case "invalid_json":
      return json(200, { status: "success", run_id: runId, outputs: { result_envelope: "{ this is not json" } });
    case "schema_invalid": {
      const env = buildEnvelope({ product, reportId, runId, status: "succeeded", payload: goldenPayload(product, reportId) });
      return json(200, { status: "success", run_id: runId, outputs: { result_envelope: JSON.stringify({ ...env, unexpected: true }) } });
    }
    case "envelope_failed": {
      const env = buildEnvelope({
        product, reportId, runId, status: "failed",
        errors: [{ code: "INPUT_INSUFFICIENT", message: "Not enough inputs to produce this report.", retryable: false }],
      });
      return json(200, { status: "success", run_id: runId, outputs: { result_envelope: JSON.stringify(env) } });
    }
    default: {
      const payload = stubPayload(product, reportId, runRequest.intake ?? {});
      // A Quick Report from a confirmed teaser echoes listing_source (quick_report 1.1.0).
      if (product === "quick_report" && runRequest.intake?.listing_source) {
        payload.listing_source = runRequest.intake.listing_source;
        (payload.meta as Record<string, unknown>).schema_version = "1.1.0";
      }
      const env = buildEnvelope({ product, reportId, runId, status: "succeeded", payload });
      return json(200, {
        status: "success",
        run_id: runId,
        outputs: { result_envelope: JSON.stringify(env), progress_log: `mock ${product}: ${files.length} file(s)` },
      });
    }
  }
}
