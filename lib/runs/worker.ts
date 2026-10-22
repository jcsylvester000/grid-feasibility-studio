/**
 * Run worker (BRD 7.3). Called in-process on your computer (RUN_DISPATCH=inline) or by the Netlify
 * Background Function run-worker (RUN_DISPATCH=netlify). Never throws; every outcome is stored.
 * VS-09 log line: ids, status, sizes and timing only, never inputs or outputs.
 */
import { claimRun, createQueuedRun, finishRun, getRun, getRunContext, setRunPhase } from "@/lib/db/repos/runs";
import type { Product, ReportStatus } from "@/lib/db/schema";
import { validateIntake } from "@/lib/forms";
import { track } from "@/lib/usage/track";
import { callPipeline, type PipelineFile } from "@/lib/vectorshift/client";
import { shouldAutoRetry } from "@/lib/vectorshift/errors";
import { parseOutputs } from "@/lib/vectorshift/parse-output";
import { appOrigin, pipelineId as pipelineFor, RETRY_DELAY_MS, timeoutMs, vectorShift } from "./config";
import { docsIntake, loadRunFiles } from "@/lib/files/run-files";
import { buildRunRequest, type RunDocument } from "./run-request";

export type RunFiles = (runId: string, reportId: string) => Promise<{ documents: RunDocument[]; files: PipelineFile[] }>;

/** File loader: signed URLs from storage (B6). Tests may replace it. */
let loadFiles: RunFiles = (runId, reportId) => loadRunFiles(runId, reportId);
export function setFileLoader(fn: RunFiles) {
  loadFiles = fn;
}

/** Keys the form validator does not know but the pipeline needs: the confirmed teaser (listing_source). */
function carried(intake: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(intake).filter(([k]) => k === "listing_source" || k === "teaser.source_report_id"));
}

function log(entry: Record<string, unknown>) {
  console.info(JSON.stringify({ evt: "vs.call", at: new Date().toISOString(), ...entry }));
}

const successStatus = (product: Product): ReportStatus => (product === "teaser_intake" ? "needs_confirmation" : "ready");

export async function executeRun(runId: string, opts: { fetchImpl?: typeof fetch; now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const run = await claimRun(runId, now());
  if (!run) return { claimed: false as const };
  const started = Date.now();
  const ctx = await getRunContext(runId);
  if (!ctx) return { claimed: true as const, status: "missing" };
  const { report, userPublicId } = ctx;
  const product = report.product as Product;

  const fail = async (code: string, extra: Partial<Parameters<typeof finishRun>[1]> = {}) => {
    const durationMs = extra.durationMs ?? Date.now() - started;
    const stored = await finishRun(runId, { status: "failed", errorCode: code, durationMs, reportStatus: "failed", ...extra }, now());
    log({ runId, product, pipelineId: run.pipelineId, vsRunId: extra.vsRunId ?? null, http: extra.httpStatus ?? null, ms: durationMs, inBytes: extra.inputBytes ?? null, outBytes: extra.outputBytes ?? null, code, ignored: !stored });
    if (!stored) return { claimed: true as const, status: "ignored" };
    await track(userPublicId, "run.failed", { product, pipelineId: run.pipelineId, durationMs, errorCode: code, status: "failed" });
    if (shouldAutoRetry(code, product, run.attempt)) await scheduleRetry(run.reportId, product, run.attempt + 1);
    return { claimed: true as const, status: "failed", code };
  };

  try {
    const pipelineId = run.pipelineId;
    const { baseUrl, apiKey } = vectorShift();
    if (!pipelineId) return await fail("VS_BAD_REQUEST", { rawFailureBody: { error: `No pipeline id configured for ${product}` } });
    if (!apiKey) return await fail("VS_AUTH", { rawFailureBody: { error: "VECTORSHIFT_API_KEY is not set" } });

    const checked = validateIntake(product, report.intake);
    let files: PipelineFile[] = [];
    let documents: RunDocument[] = [];
    try {
      ({ files, documents } = await loadFiles(runId, report.id));
    } catch (err) {
      return await fail("FILE_FETCH_FAILED", { rawFailureBody: { error: String((err as Error)?.message ?? err) } });
    }
    await setRunPhase(runId, "files_attached");

    const runRequest = buildRunRequest({
      product,
      reportId: report.id,
      attempt: run.attempt,
      intake: { ...(checked ? checked.intake : report.intake), ...carried(report.intake), ...docsIntake(documents) },
      complete: checked ? checked.ok : true,
      userPublicId,
      appOrigin: appOrigin(),
      documents,
      now: now(),
    });

    await setRunPhase(runId, "pipeline_working");
    const result = await callPipeline({ baseUrl, apiKey, pipelineId, runRequest, files, timeoutMs: timeoutMs(product), fetchImpl: opts.fetchImpl });
    const base = { vsRunId: result.vsRunId, httpStatus: result.httpStatus, inputBytes: result.inputBytes, outputBytes: result.outputBytes, durationMs: Date.now() - started };
    if (!result.ok) return await fail(result.code, { ...base, rawFailureBody: result.rawBody });

    await setRunPhase(runId, "checking");
    const parsed = parseOutputs(result.outputs, { product, reportId: report.id });
    if (!parsed.ok)
      return await fail(parsed.code, {
        ...base,
        progressLog: parsed.progressLog,
        rawFailureBody: { issues: parsed.issues ?? [], outputs: truncate(result.outputs) },
      });

    const env = parsed.envelope;
    const envelope = { schemaVersion: env.schema_version, product, envelope: env as unknown as Record<string, unknown> };
    if (env.run.status === "failed" || env.run.status === "cancelled") {
      const code = env.errors[0]?.code ?? "NODE_FAILED";
      return await fail(code, { ...base, progressLog: parsed.progressLog, envelope });
    }

    const stored = await finishRun(
      runId,
      { status: "succeeded", ...base, progressLog: parsed.progressLog, envelope, reportStatus: successStatus(product) },
      now(),
    );
    log({ runId, product, pipelineId, vsRunId: result.vsRunId, http: result.httpStatus, ms: base.durationMs, inBytes: result.inputBytes, outBytes: result.outputBytes, code: null, ignored: !stored });
    if (stored) await track(userPublicId, "run.succeeded", { product, pipelineId, durationMs: base.durationMs, status: "succeeded" });
    return { claimed: true as const, status: stored ? "succeeded" : "ignored" };
  } catch (err) {
    console.error("run worker error:", runId, err instanceof Error ? err.message : err);
    return fail("INTERNAL", { rawFailureBody: { error: String((err as Error)?.message ?? err) } });
  }
}

/** 7.3 step 6: one automatic retry after 20 seconds for retryable failures. */
async function scheduleRetry(reportId: string, product: Product, attempt: number) {
  try {
    const retry = await createQueuedRun({
      reportId,
      product,
      pipelineId: pipelineFor(product),
      attempt,
      retryAt: new Date(Date.now() + RETRY_DELAY_MS),
    });
    const { dispatchRun } = await import("./dispatch");
    await dispatchRun(retry.id, { delayMs: RETRY_DELAY_MS });
  } catch (err) {
    console.error("retry scheduling failed:", reportId, err instanceof Error ? err.message : err);
  }
}

function truncate(o: unknown) {
  const s = JSON.stringify(o ?? null);
  return s.length > 50_000 ? { truncated: s.slice(0, 50_000) } : o;
}

export { getRun };
