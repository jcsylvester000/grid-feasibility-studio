/** Starting, reading and cancelling runs (BRD 7.3, S-04, section 13). */
import { isUniqueViolation } from "@/lib/db/client";
import { getReportForUser } from "@/lib/db/repos/reports";
import {
  cancelRun as cancelRunRow,
  countActiveRunsForUser,
  countActiveRunsGlobal,
  createQueuedRun,
  failStaleRun,
  getRunForUser,
  lastAttemptForReport,
  latestRunForReport,
} from "@/lib/db/repos/runs";
import type { UserRow } from "@/lib/db/repos/users";
import type { Product } from "@/lib/db/schema";
import { validateIntake } from "@/lib/forms";
import type { Issue } from "@/lib/forms/types";
import { productsWithTypicalTimes, isEnabledProduct } from "@/lib/reports/service";
import { track } from "@/lib/usage/track";
import { canRetry, describeError } from "@/lib/vectorshift/errors";
import { MAX_ACTIVE_PER_USER, maxConcurrent, pipelineId, STALE_GRACE_MS, timeoutMs } from "./config";

export type StartResult =
  | { ok: true; runId: string }
  | { ok: false; status: number; code: string; message: string; issues?: Issue[] };

export async function startRun(user: UserRow, reportId: string): Promise<StartResult> {
  const report = await getReportForUser(user.id, reportId);
  if (!report) return { ok: false, status: 404, code: "NOT_FOUND", message: "Report not found" };
  const product = report.product as Product;
  if (!isEnabledProduct(product)) return { ok: false, status: 400, code: "PRODUCT_DISABLED", message: "This product is not available." };

  const checked = validateIntake(product, report.intake);
  if (!checked) return { ok: false, status: 400, code: "INPUT_INVALID", message: "This report form is not available yet." };
  if (!checked.ok) return { ok: false, status: 400, code: "INPUT_INVALID", message: "Some required answers are missing.", issues: checked.issues };

  if ((await countActiveRunsForUser(user.id)) >= MAX_ACTIVE_PER_USER)
    return { ok: false, status: 429, code: "RATE_LIMITED", message: describeError("RATE_LIMITED").message };
  if ((await countActiveRunsGlobal()) >= maxConcurrent())
    return { ok: false, status: 429, code: "RATE_LIMITED", message: "Many reports are running right now. Try again in a minute." };

  try {
    const run = await createQueuedRun({
      reportId: report.id,
      product,
      pipelineId: pipelineId(product),
      attempt: (await lastAttemptForReport(report.id)) + 1,
    });
    await track(user.publicId, "run.started", { product, pipelineId: run.pipelineId, status: "queued" });
    return { ok: true, runId: run.id };
  } catch (err) {
    if (isUniqueViolation(err))
      return { ok: false, status: 409, code: "RUN_IN_PROGRESS", message: "This report is already being prepared." };
    throw err;
  }
}

let typicalCache: { at: number; map: Record<string, number> } | null = null;
async function typicalMsFor(product: Product) {
  if (!typicalCache || Date.now() - typicalCache.at > 60_000) {
    const list = await productsWithTypicalTimes();
    typicalCache = { at: Date.now(), map: Object.fromEntries(list.map((p) => [p.key, p.typicalMs])) };
  }
  return typicalCache.map[product] ?? 5 * 60_000;
}

export type RunStatusView = {
  runId: string;
  reportId: string;
  product: Product;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  phase: string;
  attempt: number;
  elapsedMs: number;
  typicalMs: number;
  errorCode: string | null;
  message: string | null;
  canRetry: boolean;
  nextRunId: string | null;
  retryAt: string | null;
};

export async function getRunStatus(user: UserRow, runId: string, now = new Date()): Promise<RunStatusView | null> {
  let row = await getRunForUser(user.id, runId);
  if (!row) return null;
  const product = row.report.product as Product;

  // Safety net: a worker that died leaves the run "running" forever.
  if (row.run.status === "running" && row.run.startedAt) {
    const limit = new Date(now.getTime() - timeoutMs(product) - STALE_GRACE_MS);
    if (row.run.startedAt < limit && (await failStaleRun(runId, limit, now))) row = (await getRunForUser(user.id, runId))!;
  }
  const { run } = row;
  const latest = await latestRunForReport(run.reportId);
  const nextRunId = latest && latest.id !== run.id && latest.attempt > run.attempt ? latest.id : null;
  const from = run.startedAt ?? run.queuedAt;
  const end = run.finishedAt ?? now;
  return {
    runId: run.id,
    reportId: run.reportId,
    product,
    status: run.status,
    phase: run.phase,
    attempt: run.attempt,
    elapsedMs: Math.max(0, end.getTime() - from.getTime()),
    typicalMs: await typicalMsFor(product),
    errorCode: run.errorCode,
    message: run.status === "failed" || run.status === "cancelled" ? describeError(run.errorCode).message : null,
    canRetry: run.status === "failed" ? canRetry(run.errorCode) : run.status === "cancelled",
    nextRunId,
    retryAt: latest?.retryAt && latest.id === nextRunId ? latest.retryAt.toISOString() : null,
  };
}

export async function cancelRun(user: UserRow, runId: string) {
  const row = await getRunForUser(user.id, runId);
  if (!row) return null;
  const cancelled = await cancelRunRow(runId);
  if (cancelled) await track(user.publicId, "run.cancelled", { product: row.report.product as Product, pipelineId: row.run.pipelineId, status: "cancelled" });
  return cancelled;
}
