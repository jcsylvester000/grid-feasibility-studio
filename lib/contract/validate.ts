/**
 * Contract checks (BRD 8.1). An envelope is stored and rendered only if:
 *  1. it validates against envelope.schema.json 1.0 (which also validates `report` against the
 *     product schema named by `product`);
 *  2. its product and report_id echo the RunRequest (VS-06);
 *  3. its schema_version has the major version the app expects (rule 6).
 */
import type { Product } from "@/lib/db/schema";
import { validatorFor } from "./registry";

/** Payload schema major version the app expects back, per product. */
export const EXPECTED_SCHEMA: Record<Product, string> = {
  quick_report: "1.1.0",
  executive_summary: "1.0.0",
  feasibility_report: "1.0.0",
  teaser_intake: "1.0.0",
};

export type ContractIssue = { path: string; message: string };
export type ContractResult<T> = { ok: true; value: T } | { ok: false; issues: ContractIssue[] };

export type ResultEnvelope = {
  envelope_version: "1.0";
  schema_version: string;
  product: Product;
  report_id: string;
  idempotency_key?: string;
  run: {
    run_id: string;
    dag_id: string;
    dag_version: string;
    status: "queued" | "running" | "succeeded" | "needs_review" | "failed" | "cancelled";
    submitted_at: string;
    [k: string]: unknown;
  };
  report: Record<string, unknown> | null;
  errors: { code: string; message: string; node_id?: string | null; path?: string | null; retryable?: boolean }[];
  warnings: { code: string; message: string; node_id?: string | null; path?: string | null; retryable?: boolean }[];
};

const major = (v: string) => v.split(".")[0];

export function validateEnvelope(
  candidate: unknown,
  expected: { product: Product; reportId: string },
): ContractResult<ResultEnvelope> {
  const validate = validatorFor("envelope.schema.json");
  if (!validate(candidate)) {
    return {
      ok: false,
      issues: (validate.errors ?? []).slice(0, 20).map((e) => ({
        path: e.instancePath || "/",
        message: `${e.message ?? "invalid"}${e.params ? " " + JSON.stringify(e.params) : ""}`.slice(0, 300),
      })),
    };
  }
  const env = candidate as ResultEnvelope;
  const issues: ContractIssue[] = [];
  if (env.product !== expected.product)
    issues.push({ path: "/product", message: `expected ${expected.product}, got ${env.product}` });
  if (env.report_id !== expected.reportId) issues.push({ path: "/report_id", message: "does not echo the RunRequest" });
  if (major(env.schema_version) !== major(EXPECTED_SCHEMA[expected.product]))
    issues.push({ path: "/schema_version", message: `major version ${env.schema_version} not accepted` });
  const expectedDag = `grid.${expected.product}`;
  if (env.run.dag_id !== expectedDag) issues.push({ path: "/run/dag_id", message: `expected ${expectedDag}` });
  return issues.length ? { ok: false, issues } : { ok: true, value: env };
}

/** Validates a bare product payload (used by tests and the mock server). */
export function validatePayload(product: Product, payload: unknown): ContractResult<Record<string, unknown>> {
  const validate = validatorFor(`${product}.schema.json`);
  if (validate(payload)) return { ok: true, value: payload as Record<string, unknown> };
  return {
    ok: false,
    issues: (validate.errors ?? []).slice(0, 20).map((e) => ({ path: e.instancePath || "/", message: e.message ?? "invalid" })),
  };
}

/** Validates the RunRequest the app is about to send (VS-02). */
export function validateRunRequest(candidate: unknown): ContractResult<Record<string, unknown>> {
  const validate = validatorFor("run_request.schema.json");
  if (validate(candidate)) return { ok: true, value: candidate as Record<string, unknown> };
  return {
    ok: false,
    issues: (validate.errors ?? []).slice(0, 20).map((e) => ({ path: e.instancePath || "/", message: e.message ?? "invalid" })),
  };
}
