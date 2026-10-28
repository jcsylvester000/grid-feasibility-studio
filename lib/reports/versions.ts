/**
 * Report versions. Every run of a report is kept with its own inputs (runs.input_snapshot) and output
 * (envelopes): a successful run is a version, numbered in the order it finished (Version 1 = oldest).
 * Running a report again, with the same or edited answers, adds a version and never overwrites one.
 */
import { listRunsForReport, type RunRow } from "@/lib/db/repos/runs";
import type { Product, RunInputSnapshot } from "@/lib/db/schema";
import { describeError } from "@/lib/vectorshift/errors";
import { labelledInputs, type LabelledInput } from "./inputs";

export type VersionItem = {
  runId: string;
  /** Version number for successful runs; null for failed, cancelled or unfinished runs. */
  number: number | null;
  status: RunRow["status"];
  at: Date;
  pipelineId: string;
  errorMessage: string | null;
  inputs: LabelledInput[] | null;
  reportRef: string | null;
  sentToPipeline: boolean;
};

export function toVersions(product: Product, rows: RunRow[]): VersionItem[] {
  const ok = rows.filter((r) => r.status === "succeeded").sort((a, b) => (a.finishedAt?.getTime() ?? 0) - (b.finishedAt?.getTime() ?? 0));
  const numberOf = new Map(ok.map((r, i) => [r.id, i + 1]));
  return rows
    .map((r) => {
      const snap = r.inputSnapshot as RunInputSnapshot | null;
      return {
        runId: r.id,
        number: numberOf.get(r.id) ?? null,
        status: r.status,
        at: r.finishedAt ?? r.startedAt ?? r.queuedAt,
        pipelineId: r.pipelineId,
        errorMessage: r.status === "failed" || r.status === "cancelled" ? describeError(r.errorCode).message : null,
        inputs: snap?.intake ? labelledInputs(product, snap.intake) : null,
        reportRef: snap?.report_ref ?? null,
        sentToPipeline: !!snap?.sent,
      };
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

export async function reportVersions(reportId: string, product: Product) {
  return toVersions(product, await listRunsForReport(reportId));
}
