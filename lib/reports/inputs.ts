/** Readable answers for a report version: form labels in form order, values as the user saw them. */
import { FORMS } from "@/lib/forms";
import { fieldDictionary } from "@/lib/options";
import type { Product } from "@/lib/db/schema";
import { answerText } from "@/lib/vectorshift/quick-report-fields";

export type LabelledInput = { key: string; label: string; value: string };

const HIDDEN = new Set(["toc_mode", "listing_source", "teaser.source_report_id", "teaser.confirmed_report_id"]);

export function labelledInputs(product: Product, intake: Record<string, unknown>): LabelledInput[] {
  const dict = fieldDictionary(product);
  const form = FORMS[product];
  const out: LabelledInput[] = [];
  const seen = new Set<string>();
  for (const step of form?.steps ?? []) {
    for (const f of step.fields) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      const value = answerText(intake[f.key], dict.find((d) => d.key === f.key));
      if (value) out.push({ key: f.key, label: f.label, value });
    }
  }
  for (const [key, v] of Object.entries(intake)) {
    if (seen.has(key) || HIDDEN.has(key) || v === undefined || v === null || v === "" || typeof v === "object") continue;
    const entry = dict.find((d) => d.key === key);
    out.push({ key, label: entry?.label ?? key, value: answerText(v, entry) });
  }
  return out;
}
