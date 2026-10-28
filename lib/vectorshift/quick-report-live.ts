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
/** One fact in the market snapshot: a label and a value already formatted for display. */
export type LiveFact = { label: string; value: string };
/** Public evidence: what was found, where, and which numbered sources back it. */
export type LiveEvidence = { text: string; source: string; cites: number[] };
export type LiveSnapshotItem = {
  id: string;
  title: string;
  answer: string;
  evidence: LiveEvidence[];
  facts: LiveFact[];
  bullets: string[];
};
export type LiveSource = { n: number; url: string | null; label: string };
export type LiveSummary = { headline: string; notes: string[]; truncated: boolean };
export type QuickReportLive = {
  rating: { rating: LiveRating; label: string; headline: string; confidence: string; evidenceScore: number | null; evidenceText: string; ruleNote: string };
  metrics: [string, number][];
  checks: LiveCheck[];
  snapshot: LiveSnapshotItem[];
  snapshotDate: string;
  sources: LiveSource[];
  summary: LiveSummary | null;
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
const clean = (s: string) => s.replace(/[​-‍﻿]/g, "").trim();

/** "q1_market_land_price_evidence" → "Market land price evidence"; "lot_area_sqm" → "Lot area". */
export function humanizeKey(key: string) {
  const t = clean(key)
    .replace(/^q\d+_?/i, "")
    .replace(/_(php|pct|sqm|percent)$/i, "")
    .replace(/_/g, " ")
    .trim();
  const words = t.replace(/\b(bir|tct|cct|lgu|irr|npv|php|psa|dpwh|ncr|rdo)\b/gi, (w) => w.toUpperCase());
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : clean(key);
}

const nf = (v: number, max = 2) => new Intl.NumberFormat("en-PH", { maximumFractionDigits: max }).format(v);
/** A value for display, using the key's unit suffix: _php → ₱, _pct/_percent → %, _sqm → sqm. */
export function formatKeyed(key: string, v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (/_php$/i.test(key) || /_php_/i.test(key)) return `₱${nf(v, 0)}`;
    if (/(_pct|_percent)$/i.test(key)) return `${nf(v, 1)}%`;
    if (/_sqm$/i.test(key)) return `${nf(v, 0)} sqm`;
    return nf(v);
  }
  if (isObj(v) && ("low" in v || "high" in v)) return [formatKeyed(key, v.low), formatKeyed(key, v.high)].filter(Boolean).join(" – ");
  return clean(str(v));
}

/** "[2]", "[2][5]", "2", 2 → [2, 5] */
const citeNumbers = (v: unknown): number[] => {
  const s = Array.isArray(v) ? v.map(str).join(" ") : str(v);
  return [...s.matchAll(/\d{1,3}/g)].map((m) => Number(m[0])).filter((n) => n > 0);
};

/** Checks may be an array, or an object holding an array (e.g. { checks: [...] }), or an object of checks. */
function readChecks(v: unknown): LiveCheck[] {
  let list: unknown[] = [];
  if (Array.isArray(v)) list = v;
  else if (isObj(v)) {
    const inner = Object.values(v).find(Array.isArray);
    list = inner ?? Object.entries(v).map(([key, c]) => (isObj(c) ? { key, ...c } : { key, detail: str(c) }));
  }
  return list
    .filter(isObj)
    .map((c) => ({ key: str(c.key), ok: typeof c.ok === "boolean" ? c.ok : null, tone: str(c.tone) || "info", detail: clean(str(c.detail ?? c.message ?? c.text)) }))
    .filter((c) => c.detail);
}

/** Sources may be strings or objects ({ url, citation, title }); numbered by their citation when given. */
function readSources(v: unknown): LiveSource[] {
  if (!Array.isArray(v)) return [];
  const out: LiveSource[] = [];
  v.forEach((s, i) => {
    const url = isObj(s) ? str(s.url ?? s.link ?? s.href) : str(s);
    const label = isObj(s) ? clean(str(s.title ?? s.name ?? s.source ?? "")) : "";
    const n = isObj(s) ? citeNumbers(s.citation ?? s.id)[0] ?? i + 1 : i + 1;
    const safe = /^https?:\/\/[^\s"<>]+$/i.test(url.trim()) ? url.trim() : null;
    // A non-link entry is kept only as a plain title (never a "scheme:" string such as javascript:).
    const plain = !safe && url && !/^[a-z][a-z0-9+.-]*:/i.test(url.trim()) ? clean(url) : "";
    if (safe || label || plain) out.push({ n, url: safe, label: label || plain });
  });
  return out.sort((a, b) => a.n - b.n);
}

const SNAPSHOT_SKIP = new Set(["report_id", "location", "date", "as_of", "today"]);

/** One snapshot section from any reasonable shape: question/answer text, evidence lists, facts and notes. */
function readSnapshotItem(id: string, q: Record<string, unknown>): LiveSnapshotItem {
  const item: LiveSnapshotItem = { id, title: clean(str(q.question)) || humanizeKey(id), answer: clean(str(q.answer ?? q.summary ?? q.finding)), evidence: [], facts: [], bullets: [] };
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, x] of Object.entries(obj)) {
      if (["question", "answer", "summary"].includes(k) && obj === q) continue;
      // The broker's own figures repeat the answers shown under "What this screen used".
      if (/^broker_/i.test(k)) continue;
      if (Array.isArray(x)) {
        for (const e of x) {
          if (isObj(e)) {
            const text = clean(str(e.finding ?? e.text ?? e.detail ?? e.description ?? e.note ?? e.answer));
            if (text) item.evidence.push({ text, source: clean(str(e.source ?? e.name ?? e.title)), cites: citeNumbers(e.citation ?? e.citations ?? e.source_id) });
            else item.facts.push(...Object.entries(e).filter(([, y]) => !isObj(y) && !Array.isArray(y)).map(([kk, y]) => ({ label: humanizeKey(kk), value: formatKeyed(kk, y) })));
          } else if (str(e)) item.bullets.push(clean(str(e)));
        }
      } else if (isObj(x) && !("low" in x || "high" in x)) {
        walk(x, humanizeKey(k));
      } else {
        const value = formatKeyed(k, x);
        if (value) item.facts.push({ label: prefix && obj !== q ? `${humanizeKey(k)}` : humanizeKey(k), value });
      }
    }
  };
  walk(q, "");
  return item;
}

/**
 * The writer's draft: plain text, or JSON text { headline, notes[] } that may be cut off. Returns the
 * headline and every complete note; truncated is true when the text was cut off.
 */
export function readSummary(draft: string): LiveSummary | null {
  const t = draft.trim();
  if (!t) return null;
  if (!t.startsWith("{")) return { headline: "", notes: [t], truncated: false };
  const parsed = parseJsonLoose(t);
  if (isObj(parsed)) {
    const notes = Array.isArray(parsed.notes) ? parsed.notes.map((x) => clean(str(x))).filter(Boolean) : [];
    const body = clean(str(parsed.body ?? parsed.text ?? parsed.summary));
    return { headline: clean(str(parsed.headline ?? parsed.title)), notes: body ? [body, ...notes] : notes, truncated: false };
  }
  // Cut off: keep the complete JSON strings only.
  const jsonString = /"((?:[^"\\]|\\.)*)"/g;
  const headline = t.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
  const notesStart = t.search(/"notes"\s*:\s*\[/);
  const notes: string[] = [];
  if (notesStart >= 0) {
    const rest = t.slice(t.indexOf("[", notesStart) + 1);
    for (const m of rest.matchAll(jsonString)) notes.push(m[1]!);
  }
  const unescape = (s: string) => {
    try {
      return JSON.parse(`"${s}"`) as string;
    } catch {
      return s;
    }
  };
  return { headline: headline ? clean(unescape(headline)) : "", notes: notes.map((n) => clean(unescape(n))).filter(Boolean), truncated: true };
}

/** Checks and normalises a parsed live result. Only `rating.rating` is required. */
export function normaliseLive(v: unknown): { ok: true; value: QuickReportLive } | { ok: false; issues: string[] } {
  if (!isObj(v)) return { ok: false, issues: ["result is not an object"] };
  const r = isObj(v.rating) ? v.rating : null;
  const rating = r ? str(r.rating).toLowerCase().replace(/[\s-]+/g, "_").replace(/^can_?not_tell|^cant_tell/, "cannot_tell") : "";
  if (!LIVE_RATINGS.includes(rating as LiveRating)) return { ok: false, issues: [`rating.rating must be one of ${LIVE_RATINGS.join(", ")}`] };
  const rule = r && isObj(r.rule) ? r.rule : {};
  const metrics = isObj(v.metrics)
    ? Object.entries(v.metrics).filter((e): e is [string, number] => typeof e[1] === "number" && Number.isFinite(e[1]))
    : [];
  const ms = isObj(v.market_snapshot) ? v.market_snapshot : {};
  const snapshot = Object.entries(ms)
    .filter((e): e is [string, Record<string, unknown>] => isObj(e[1]) && !SNAPSHOT_SKIP.has(e[0]))
    .sort(([a], [b]) => (Number(a.match(/^q(\d+)/i)?.[1] ?? 99) - Number(b.match(/^q(\d+)/i)?.[1] ?? 99)) || a.localeCompare(b))
    .map(([id, q]) => readSnapshotItem(id, q))
    .filter((q) => q.answer || q.evidence.length || q.facts.length || q.bullets.length);
  const inputs = isObj(v.quick_report_inputs) ? Object.entries(v.quick_report_inputs).map(([k, x]) => [k, str(x)] as [string, string]) : [];
  const draft = str(v.draft).trim();
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
      checks: readChecks(v.checks),
      snapshot,
      snapshotDate: str(ms.date ?? ms.as_of),
      sources: readSources(v.sources),
      summary: readSummary(draft),
      draft,
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
