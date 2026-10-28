/**
 * Output of the live Quick Report pipeline (VectorShift, Oct 2026). outputs.result_envelope is JSON text:
 *   { quick_report_inputs, market_snapshot{q1..}, sources[], checks[], metrics{}, rating{}, draft, qa_result }
 * plus cost outputs (Q01_tag_and_range_cost, Q06_one_page_writer_cost, ...). This is not the BRD contract
 * envelope, so it is checked here (lenient, but every rendered value is typed) and stored as its own format.
 * If the pipeline later returns a contract envelope (schema_version + report), the contract path is used.
 */

export const QR_LIVE_FORMAT = "vs_quick_report";
export const QR_LIVE_SCHEMA = "vs_quick_report/1";

export const LIVE_RATINGS = ["promising", "marginal", "weak", "cannot_tell"] as const;
export type LiveRating = (typeof LIVE_RATINGS)[number];

export type LiveCheck = { key: string; ok: boolean | null; tone: string; detail: string };
export type LiveSnapshotItem = { id: string; question: string; answer: string; extra: [string, string][] };
export type QuickReportLive = {
  rating: { rating: LiveRating; label: string; headline: string; confidence: string; evidenceScore: number | null; evidenceText: string; ruleNote: string };
  metrics: [string, number][];
  checks: LiveCheck[];
  snapshot: LiveSnapshotItem[];
  sources: string[];
  draft: string;
  qa: string;
  inputs: [string, string][];
};

/**
 * What is stored in envelopes.envelope for a live Quick Report run: the pipeline's result exactly as
 * returned (normalised again when shown, so the viewer can improve without rewriting stored rows).
 */
export type LiveEnvelope = {
  format: typeof QR_LIVE_FORMAT;
  version: 1;
  report_ref: string | null;
  vs_run_id: string | null;
  result: unknown;
  costs: Record<string, string>;
};

/** JSON.parse that tolerates ```json fences, a leading "json" label and text around the object. */
export function parseJsonLoose(raw: unknown): unknown {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw !== "string") return undefined;
  let t = raw.replace(/^﻿/, "").trim();
  const fence = t.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1]!.trim();
  t = t.replace(/^json\s*(?=[{[])/i, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Checks and normalises a parsed live result. Only `rating.rating` is required. */
export function normaliseLive(v: unknown): { ok: true; value: QuickReportLive } | { ok: false; issues: string[] } {
  if (!isObj(v)) return { ok: false, issues: ["result is not an object"] };
  const r = isObj(v.rating) ? v.rating : null;
  const rating = r ? str(r.rating).toLowerCase().replace(/[\s-]+/g, "_") : "";
  if (!LIVE_RATINGS.includes(rating as LiveRating)) return { ok: false, issues: [`rating.rating must be one of ${LIVE_RATINGS.join(", ")}`] };
  const rule = r && isObj(r.rule) ? r.rule : {};
  const metrics = isObj(v.metrics)
    ? Object.entries(v.metrics).filter((e): e is [string, number] => typeof e[1] === "number" && Number.isFinite(e[1]))
    : [];
  const checks = Array.isArray(v.checks)
    ? v.checks.filter(isObj).map((c) => ({ key: str(c.key), ok: typeof c.ok === "boolean" ? c.ok : null, tone: str(c.tone) || "info", detail: str(c.detail) })).filter((c) => c.detail)
    : [];
  const snapshot = isObj(v.market_snapshot)
    ? Object.entries(v.market_snapshot)
        .filter((e): e is [string, Record<string, unknown>] => isObj(e[1]))
        .map(([id, q]) => ({
          id,
          question: str(q.question),
          answer: str(q.answer),
          extra: Object.entries(q)
            .filter(([k, x]) => k !== "question" && k !== "answer" && str(x))
            .map(([k, x]) => [k, str(x)] as [string, string]),
        }))
        .filter((q) => q.question || q.answer)
    : [];
  const inputs = isObj(v.quick_report_inputs)
    ? Object.entries(v.quick_report_inputs).map(([k, x]) => [k, str(x)] as [string, string])
    : [];
  return {
    ok: true,
    value: {
      rating: {
        rating: rating as LiveRating,
        label: str(r!.label) || rating.replace(/_/g, " "),
        headline: str(r!.headline),
        confidence: str(r!.confidence) || "unknown",
        evidenceScore: typeof r!.evidence_score === "number" ? r!.evidence_score : null,
        evidenceText: str(r!.evidence_text),
        ruleNote: str(rule.note),
      },
      metrics,
      checks,
      snapshot,
      sources: Array.isArray(v.sources) ? v.sources.map(str).filter(Boolean) : [],
      draft: str(v.draft).trim(),
      qa: str(v.qa_result).trim(),
      inputs,
    },
  };
}

export type LiveParse =
  | { ok: true; kind: "live"; result: QuickReportLive; raw: unknown; costs: Record<string, string> }
  | { ok: true; kind: "contract"; candidate: unknown }
  | { ok: false; code: "VS_OUTPUT_MISSING" | "SCHEMA_INVALID"; issues: string[] };

/** Reads the pipeline outputs of a live Quick Report run. */
export function parseLiveOutputs(outputs: Record<string, unknown>): LiveParse {
  const raw = outputs.result_envelope;
  if (raw === undefined || raw === null || raw === "") return { ok: false, code: "VS_OUTPUT_MISSING", issues: ["result_envelope is empty"] };
  const parsed = parseJsonLoose(raw);
  if (parsed === undefined) return { ok: false, code: "SCHEMA_INVALID", issues: ["result_envelope is not valid JSON"] };
  if (isObj(parsed) && "schema_version" in parsed && "report" in parsed) return { ok: true, kind: "contract", candidate: parsed };
  const n = normaliseLive(parsed);
  if (!n.ok) return { ok: false, code: "SCHEMA_INVALID", issues: n.issues };
  const costs = Object.fromEntries(Object.entries(outputs).filter(([k]) => /_cost$/i.test(k)).map(([k, x]) => [k, str(x)]));
  return { ok: true, kind: "live", result: n.value, raw: parsed, costs };
}

export const isLiveEnvelope = (e: unknown): e is LiveEnvelope => isObj(e) && e.format === QR_LIVE_FORMAT;
