/**
 * Runs and envelopes (BRD 7.3, 14.1). Run: queued → running → succeeded | failed | cancelled.
 * Only one run per report may be queued or running (partial unique index runs_one_active_per_report).
 */
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "../client";
import { envelopes, reports, runs, users, type Product, type ReportStatus, type RunInputSnapshot, type RunPhase } from "../schema";

export type RunRow = typeof runs.$inferSelect;

const ACTIVE = ["queued", "running"] as const;

export async function countActiveRunsForUser(userId: string) {
  const db = await getDb();
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(runs)
    .innerJoin(reports, eq(runs.reportId, reports.id))
    .where(and(eq(reports.userId, userId), inArray(runs.status, [...ACTIVE])));
  return Number(r?.n ?? 0);
}

export async function countActiveRunsGlobal() {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(runs).where(inArray(runs.status, [...ACTIVE]));
  return Number(r?.n ?? 0);
}

export async function lastAttemptForReport(reportId: string) {
  const db = await getDb();
  const [r] = await db.select({ attempt: sql<number>`coalesce(max(${runs.attempt}), 0)::int` }).from(runs).where(eq(runs.reportId, reportId));
  return Number(r?.attempt ?? 0);
}

export class RunLimitError extends Error {
  constructor(public readonly scope: "user" | "global") {
    super(`run limit reached (${scope})`);
  }
}

/**
 * Inserts a queued run and moves the report to "queued" in one transaction. Throws on the active-run
 * unique index. With `limits`, the per-user and global active-run limits are checked inside the
 * transaction under an advisory lock, so a burst of requests cannot exceed them (B9 load test, GFS-25).
 */
export async function createQueuedRun(
  values: {
    reportId: string;
    product: Product;
    pipelineId: string;
    attempt: number;
    retryAt?: Date | null;
    inputSnapshot?: RunInputSnapshot | null;
  },
  limits?: { userId: string; perUser: number; global: number },
) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    if (limits) {
      await tx.execute(sql`select pg_advisory_xact_lock(7311001)`);
      const [mine] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(runs)
        .innerJoin(reports, eq(runs.reportId, reports.id))
        .where(and(eq(reports.userId, limits.userId), inArray(runs.status, [...ACTIVE])));
      if (Number(mine?.n ?? 0) >= limits.perUser) throw new RunLimitError("user");
      const [all] = await tx.select({ n: sql<number>`count(*)::int` }).from(runs).where(inArray(runs.status, [...ACTIVE]));
      if (Number(all?.n ?? 0) >= limits.global) throw new RunLimitError("global");
    }
    const [run] = await tx
      .insert(runs)
      .values({ ...values, status: "queued", phase: "request_sent", retryAt: values.retryAt ?? null, inputSnapshot: values.inputSnapshot ?? null })
      .returning();
    await tx.update(reports).set({ status: "queued", updatedAt: new Date() }).where(eq(reports.id, values.reportId));
    return run!;
  });
}

/** Atomic claim (queued → running). A second claim returns null, so a run is never sent twice (7.3 step 2). */
export async function claimRun(runId: string, now = new Date()) {
  const db = await getDb();
  const [run] = await db
    .update(runs)
    .set({ status: "running", startedAt: now, phase: "request_sent" })
    .where(and(eq(runs.id, runId), eq(runs.status, "queued")))
    .returning();
  if (!run) return null;
  await db.update(reports).set({ status: "running", updatedAt: now }).where(eq(reports.id, run.reportId));
  return run;
}

export async function setRunPhase(runId: string, phase: RunPhase) {
  const db = await getDb();
  await db.update(runs).set({ phase }).where(and(eq(runs.id, runId), eq(runs.status, "running")));
}

/** Records exactly what was sent to the pipeline (the intake part is written when the run is queued). */
export async function recordRunInputs(runId: string, snapshot: RunInputSnapshot) {
  const db = await getDb();
  await db.update(runs).set({ inputSnapshot: snapshot }).where(eq(runs.id, runId));
}

/** Every run of a report, oldest first (the version history). Envelope bodies are not loaded. */
export async function listRunsForReport(reportId: string) {
  const db = await getDb();
  return db.select().from(runs).where(eq(runs.reportId, reportId)).orderBy(runs.queuedAt);
}

/** The stored envelope of one succeeded run of a report (an older version). */
export async function envelopeForReportRun(reportId: string, runId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null;
  const db = await getDb();
  const [e] = await db
    .select({ envelope: envelopes, run: runs })
    .from(envelopes)
    .innerJoin(runs, eq(envelopes.runId, runs.id))
    .where(and(eq(runs.reportId, reportId), eq(runs.id, runId), eq(runs.status, "succeeded")))
    .limit(1);
  return e ?? null;
}

export async function getRun(runId: string) {
  const db = await getDb();
  const [r] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  return r ?? null;
}

/** A run with its report and the owner's public ID (worker use). */
export async function getRunContext(runId: string) {
  const db = await getDb();
  const [r] = await db
    .select({ run: runs, report: reports, userPublicId: users.publicId })
    .from(runs)
    .innerJoin(reports, eq(runs.reportId, reports.id))
    .innerJoin(users, eq(reports.userId, users.id))
    .where(eq(runs.id, runId))
    .limit(1);
  return r ?? null;
}

/** Owner-scoped read for the run status API. */
export async function getRunForUser(userId: string, runId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null;
  const db = await getDb();
  const [r] = await db
    .select({ run: runs, report: reports })
    .from(runs)
    .innerJoin(reports, eq(runs.reportId, reports.id))
    .where(and(eq(runs.id, runId), eq(reports.userId, userId)))
    .limit(1);
  return r ?? null;
}

export async function latestRunForReport(reportId: string) {
  const db = await getDb();
  const [r] = await db.select().from(runs).where(eq(runs.reportId, reportId)).orderBy(desc(runs.attempt), desc(runs.queuedAt)).limit(1);
  return r ?? null;
}

type Finish = {
  status: "succeeded" | "failed";
  errorCode?: string | null;
  vsRunId?: string | null;
  httpStatus?: number | null;
  inputBytes?: number | null;
  outputBytes?: number | null;
  durationMs: number;
  progressLog?: string | null;
  rawFailureBody?: unknown;
  envelope?: { schemaVersion: string; product: Product; envelope: Record<string, unknown> } | null;
  reportStatus: ReportStatus;
};

/**
 * Finishes a running run. Ignored (returns false) when the run is no longer "running", e.g. the user
 * cancelled it while VectorShift was still working (VS-11).
 */
export async function finishRun(runId: string, f: Finish, now = new Date()) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [run] = await tx
      .update(runs)
      .set({
        status: f.status,
        phase: f.status === "succeeded" ? "done" : undefined,
        errorCode: f.errorCode ?? null,
        vsRunId: f.vsRunId ?? null,
        httpStatus: f.httpStatus ?? null,
        inputBytes: f.inputBytes ?? null,
        outputBytes: f.outputBytes ?? null,
        durationMs: f.durationMs,
        progressLog: f.progressLog ?? null,
        finishedAt: now,
        rawFailureBody: f.rawFailureBody === undefined ? null : (f.rawFailureBody as object),
        rawFailureExpiresAt: f.rawFailureBody === undefined ? null : new Date(now.getTime() + 30 * 86400_000),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")))
      .returning();
    if (!run) return false;
    if (f.envelope) await tx.insert(envelopes).values({ runId, ...f.envelope }).onConflictDoNothing();
    await tx.update(reports).set({ status: f.reportStatus, updatedAt: now }).where(eq(reports.id, run.reportId));
    return true;
  });
}

/** Cancel (VS-11): marks the run cancelled and returns the report to draft so it can be edited and run again. */
export async function cancelRun(runId: string, now = new Date()) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [run] = await tx
      .update(runs)
      .set({ status: "cancelled", finishedAt: now, errorCode: "RUN_CANCELLED" })
      .where(and(eq(runs.id, runId), inArray(runs.status, [...ACTIVE])))
      .returning();
    if (!run) return null;
    await tx.update(reports).set({ status: "draft", updatedAt: now }).where(eq(reports.id, run.reportId));
    return run;
  });
}

/** A queued run that could not be handed to the worker (dispatch failed): failed, so the report is free again. */
export async function failQueuedRun(runId: string, code: string, now = new Date()) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [run] = await tx
      .update(runs)
      .set({ status: "failed", errorCode: code, finishedAt: now })
      .where(and(eq(runs.id, runId), eq(runs.status, "queued")))
      .returning();
    if (!run) return null;
    await tx.update(reports).set({ status: "failed", updatedAt: now }).where(eq(reports.id, run.reportId));
    return run;
  });
}

/**
 * Safety net for a worker that died (function killed, process restart): running runs older than their
 * timeout plus a grace period are failed with VS_TIMEOUT.
 */
export async function failStaleRun(runId: string, olderThan: Date, now = new Date()) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [run] = await tx
      .update(runs)
      .set({ status: "failed", errorCode: "VS_TIMEOUT", finishedAt: now })
      .where(and(eq(runs.id, runId), eq(runs.status, "running"), lt(runs.startedAt, olderThan)))
      .returning();
    if (!run) return null;
    await tx.update(reports).set({ status: "failed", updatedAt: now }).where(eq(reports.id, run.reportId));
    return run;
  });
}

export async function envelopeForRun(runId: string) {
  const db = await getDb();
  const [e] = await db.select().from(envelopes).where(eq(envelopes.runId, runId)).limit(1);
  return e ?? null;
}

/** The most recent stored envelope for a report (the viewer reads only validated, stored envelopes). */
export async function latestEnvelopeForReport(reportId: string) {
  const db = await getDb();
  const [e] = await db
    .select({ envelope: envelopes, run: runs })
    .from(envelopes)
    .innerJoin(runs, eq(envelopes.runId, runs.id))
    .where(and(eq(runs.reportId, reportId), eq(runs.status, "succeeded")))
    .orderBy(desc(runs.finishedAt))
    .limit(1);
  return e ?? null;
}

/**
 * Demo scenarios: stores a finished run with its envelope and marks the report ready, in one transaction.
 * Only lib/demo/seed.ts calls this (prototype demo data, never real pipeline output).
 */
export async function insertFinishedRun(values: {
  reportId: string;
  product: Product;
  pipelineId: string;
  vsRunId: string;
  durationMs: number;
  envelope: { schemaVersion: string; envelope: Record<string, unknown> };
  at: Date;
  inputSnapshot?: RunInputSnapshot | null;
}) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(runs)
      .values({
        reportId: values.reportId,
        product: values.product,
        pipelineId: values.pipelineId,
        attempt: 1,
        status: "succeeded",
        phase: "done",
        vsRunId: values.vsRunId,
        httpStatus: 200,
        durationMs: values.durationMs,
        queuedAt: new Date(values.at.getTime() - values.durationMs),
        startedAt: new Date(values.at.getTime() - values.durationMs),
        finishedAt: values.at,
        inputSnapshot: values.inputSnapshot ?? null,
      })
      .returning();
    await tx.insert(envelopes).values({ runId: run!.id, product: values.product, ...values.envelope });
    await tx.update(reports).set({ status: "ready", updatedAt: values.at }).where(eq(reports.id, values.reportId));
    return run!;
  });
}
