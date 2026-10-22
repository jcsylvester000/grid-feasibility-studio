/** Builds ResultEnvelopes (used by the mock VectorShift server and tests). */
import type { Product } from "@/lib/db/schema";
import type { ResultEnvelope } from "./validate";

type Problem = ResultEnvelope["errors"][number];

export function buildEnvelope(opts: {
  product: Product;
  reportId: string;
  runId: string;
  dagVersion?: string;
  status: "succeeded" | "failed";
  payload?: Record<string, unknown> | null;
  errors?: Problem[];
  submittedAt?: Date;
}): ResultEnvelope {
  const now = new Date();
  const payload = opts.status === "succeeded" ? (opts.payload ?? null) : null;
  const schemaVersion =
    payload && typeof payload.meta === "object" && payload.meta && "schema_version" in payload.meta
      ? String((payload.meta as Record<string, unknown>).schema_version)
      : "1.0.0";
  return {
    envelope_version: "1.0",
    schema_version: schemaVersion,
    product: opts.product,
    report_id: opts.reportId,
    run: {
      run_id: opts.runId,
      dag_id: `grid.${opts.product}`,
      dag_version: opts.dagVersion ?? "mock-0.1.0",
      status: opts.status,
      submitted_at: (opts.submittedAt ?? now).toISOString(),
      started_at: (opts.submittedAt ?? now).toISOString(),
      finished_at: now.toISOString(),
    },
    report: payload,
    errors: opts.status === "failed" ? (opts.errors ?? [{ code: "NODE_FAILED", message: "Pipeline step failed." }]) : [],
    warnings: [],
  };
}
