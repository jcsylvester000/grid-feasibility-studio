/** Reads outputs.result_envelope (JSON text or object) and validates it (VS-04, BRD 8.1). */
import type { Product } from "@/lib/db/schema";
import { validateEnvelope, type ContractIssue, type ResultEnvelope } from "@/lib/contract/validate";

export type ParsedOutput =
  | { ok: true; envelope: ResultEnvelope; progressLog: string | null }
  | { ok: false; code: "VS_OUTPUT_MISSING" | "SCHEMA_INVALID"; issues?: ContractIssue[]; progressLog: string | null };

export function parseOutputs(outputs: Record<string, unknown>, expected: { product: Product; reportId: string }): ParsedOutput {
  const progressLog = typeof outputs.progress_log === "string" ? outputs.progress_log.slice(0, 20_000) : null;
  const raw = outputs.result_envelope;
  if (raw === undefined || raw === null || raw === "") return { ok: false, code: "VS_OUTPUT_MISSING", progressLog };
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return { ok: false, code: "SCHEMA_INVALID", issues: [{ path: "/", message: "result_envelope is not valid JSON" }], progressLog };
    }
  }
  const v = validateEnvelope(candidate, expected);
  if (!v.ok) return { ok: false, code: "SCHEMA_INVALID", issues: v.issues, progressLog };
  return { ok: true, envelope: v.value, progressLog };
}
