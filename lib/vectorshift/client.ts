/**
 * VectorShift pipelines API client (BRD 7.1). All calls to VectorShift go through this module.
 *   POST {base}/v1/pipeline/{id}/run   Authorization: Bearer <key>
 *   JSON  { inputs: { run_request } }  or  multipart: inputs (JSON string) + inputs.file_1..file_10
 * The API key is read on the server only and never logged (VS-08).
 */
import type { AppCode } from "./errors";

export type PipelineFile = { name: string; mime: string; bytes: Uint8Array };

export type CallResult =
  | {
      ok: true;
      httpStatus: number;
      vsRunId: string | null;
      outputs: Record<string, unknown>;
      durationMs: number;
      inputBytes: number;
      outputBytes: number;
    }
  | {
      ok: false;
      code: AppCode;
      httpStatus: number | null;
      vsRunId: string | null;
      rawBody: unknown;
      durationMs: number;
      inputBytes: number;
      outputBytes: number;
    };

export async function callPipeline(opts: {
  baseUrl: string;
  apiKey: string;
  pipelineId: string;
  runRequest: object;
  files?: PipelineFile[];
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<CallResult> {
  const started = Date.now();
  const runRequestText = JSON.stringify(opts.runRequest);
  let body: BodyInit;
  let inputBytes = Buffer.byteLength(runRequestText);
  const headers: Record<string, string> = { authorization: `Bearer ${opts.apiKey}`, accept: "application/json" };

  if (opts.files?.length) {
    const form = new FormData();
    form.set("inputs", JSON.stringify({ run_request: runRequestText }));
    opts.files.slice(0, 10).forEach((f, i) => {
      form.set(`inputs.file_${i + 1}`, new Blob([f.bytes as BlobPart], { type: f.mime }), f.name);
      inputBytes += f.bytes.byteLength;
    });
    body = form;
  } else {
    body = JSON.stringify({ inputs: { run_request: runRequestText } });
    headers["content-type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const url = `${opts.baseUrl.replace(/\/$/, "")}/v1/pipeline/${encodeURIComponent(opts.pipelineId)}/run`;
  const fail = (code: AppCode, httpStatus: number | null, rawBody: unknown, outputBytes = 0, vsRunId: string | null = null) =>
    ({ ok: false, code, httpStatus, vsRunId, rawBody, durationMs: Date.now() - started, inputBytes, outputBytes }) as const;

  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(url, { method: "POST", headers, body, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const aborted = controller.signal.aborted;
    return fail(aborted ? "VS_TIMEOUT" : "VS_UNAVAILABLE", null, { error: aborted ? "timeout" : String((err as Error)?.message ?? err) });
  }

  let text = "";
  try {
    text = await res.text();
  } catch {
    clearTimeout(timer);
    return fail(controller.signal.aborted ? "VS_TIMEOUT" : "VS_UNAVAILABLE", res.status, { error: "body read failed" });
  }
  clearTimeout(timer);
  const outputBytes = Buffer.byteLength(text);
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const raw = parsed ?? { text: text.slice(0, 20_000) };
  const vsRunId = typeof parsed?.run_id === "string" ? parsed.run_id : null;

  if (res.status === 401 || res.status === 403) return fail("VS_AUTH", res.status, raw, outputBytes, vsRunId);
  if (res.status === 400 || res.status === 404 || res.status === 422) return fail("VS_BAD_REQUEST", res.status, raw, outputBytes, vsRunId);
  if (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 429) return fail("VS_UNAVAILABLE", res.status, raw, outputBytes, vsRunId);
  if (res.status >= 500) return fail("VS_FAILED", res.status, raw, outputBytes, vsRunId);
  if (!res.ok || !parsed) return fail("VS_FAILED", res.status, raw, outputBytes, vsRunId);
  if (parsed.status !== "success") return fail("VS_FAILED", res.status, raw, outputBytes, vsRunId);
  const outputs = (parsed.outputs ?? {}) as Record<string, unknown>;
  return { ok: true, httpStatus: res.status, vsRunId, outputs, durationMs: Date.now() - started, inputBytes, outputBytes };
}
