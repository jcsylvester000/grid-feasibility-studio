/**
 * Check and confirm (Teaser design S-18): turns a teaser_intake payload into what the confirm screen
 * shows: the pre-filled Quick Report answers with the quote behind each, the conflicts the broker must
 * resolve, and the listing_source block the Quick Report carries (quick_report 1.1.0).
 * Pure functions: used by the confirm page (server) and the confirm API.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { quickReportForm } from "@/lib/forms/quick-report";

export type FactSource = { factKey: string; label: string; quote: string | null; where: string | null; confidence: string | null; note: string | null };

export type ConflictGroup = {
  key: string;
  label: string;
  message: string;
  options: { key: string; label: string; quote: string | null }[];
};

const QR_KEYS = new Set(quickReportForm.steps.flatMap((s) => s.fields.map((f) => f.key)));

/** { property: { city: "Taguig" }, qd: { lot_area: 15000 } } → { "property.city": "Taguig", "qd.lot_area": 15000 } */
export function flattenIntake(obj: unknown, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flattenIntake(v, key));
    else out[key] = v;
  }
  return out;
}

/** Pre-filled Quick Report answers: only keys the Quick Report form has. */
export function prefill(payload: any): Record<string, unknown> {
  const flat = flattenIntake(payload?.mapping?.intake ?? {});
  for (const m of payload?.mapping?.mapped ?? []) flat[m.field_key] = m.value;
  return Object.fromEntries(Object.entries(flat).filter(([k, v]) => QR_KEYS.has(k) && v !== null && v !== undefined && v !== ""));
}

/** The quote behind each pre-filled field ("from teaser" chip). */
export function fieldSources(payload: any): Record<string, FactSource> {
  const facts: any[] = payload?.listing?.facts ?? [];
  const out: Record<string, FactSource> = {};
  for (const m of payload?.mapping?.mapped ?? []) {
    const fact = facts.find((f) => f.key === m.fact_key);
    const where = fact?.source ? [fact.source.doc_ref, fact.source.page ? `page ${fact.source.page}` : null, fact.source.timestamp_s != null ? `${fact.source.timestamp_s}s` : null].filter(Boolean).join(", ") : null;
    out[m.field_key] = {
      factKey: m.fact_key,
      label: fact?.label ?? m.fact_key,
      quote: fact?.source?.quote ?? fact?.value_text ?? null,
      where: where || null,
      confidence: fact?.confidence ?? null,
      note: m.note ?? null,
    };
  }
  return out;
}

const rootOf = (key: string) => key.replace(/_(post|alt|video|text|2|3)$/, "");

/** Facts that disagree, grouped by what they describe (lot_area and lot_area_post). TS-AC-02. */
export function conflictGroups(payload: any): ConflictGroup[] {
  const facts: any[] = (payload?.listing?.facts ?? []).filter((f: any) => f.conflict);
  const groups = new Map<string, ConflictGroup>();
  for (const f of facts) {
    const key = rootOf(f.key);
    const g: ConflictGroup = groups.get(key) ?? { key, label: f.label.replace(/\s*\(.*\)$/, ""), message: f.conflict, options: [] };
    g.options.push({ key: f.key, label: f.value_text, quote: f.source?.quote ?? null });
    groups.set(key, g);
  }
  for (const g of groups.values()) g.options.push({ key: "unconfirmed", label: "Neither is confirmed yet: keep it “to be confirmed”", quote: null });
  return [...groups.values()];
}

export function unresolved(payload: any, resolutions: Record<string, string>) {
  return conflictGroups(payload).filter((g) => !g.options.some((o) => o.key === resolutions[g.key]));
}

/** listing_source for the Quick Report (teaser_intake.schema.json $defs/ListingSource). */
export function listingSource(payload: any, confirmed: Record<string, unknown>) {
  const pre = prefill(payload);
  const mappedKeys = Object.keys(pre);
  const edited = mappedKeys.filter((k) => String(confirmed[k] ?? "") !== String(pre[k])).length;
  return {
    intake_id: String(payload.meta.intake_id),
    files_count: Math.max(1, (payload.files ?? []).length),
    relationship: String(payload.meta.relationship),
    broker_confirmed_fields: mappedKeys.length - edited,
    broker_edited_fields: edited,
    claims: payload.claims ?? [],
    red_flags: payload.red_flags ?? [],
    questions_for_seller: payload.questions_for_seller ?? [],
  };
}
