/**
 * Live Quick Report pipeline inputs (VectorShift pipeline built by GRID, Oct 2026). The pipeline takes
 * 21 named text inputs instead of one run_request: each answer is sent as the text the user saw in the
 * dropdown (e.g. "₱42,000 per sqm"), never as an internal code. Unanswered fields are sent as "".
 */
import type { FieldEntry } from "@/lib/options";
import { fieldDictionary } from "@/lib/options";

/** Pipeline input name → intake key. Order follows the form. */
export const QR_PIPELINE_INPUTS: ReadonlyArray<readonly [string, string | null]> = [
  ["report_id", null],
  ["today", null],
  ["region", "property.region"],
  ["province", "property.province"],
  ["city_municipality", "property.city"],
  ["road_access", "property.road_access"],
  ["lot_area", "qd.lot_area"],
  ["building_on_site", "qd.floor_area"],
  ["client_goal", "use.goal"],
  ["client_type", "owner.type"],
  ["title_copy", "qd.title_copy"],
  ["tax_declaration_copy", "qd.tax_dec"],
  ["asking_price_per_sqm", "qd.ask_psqm"],
  ["bir_zonal_value", "qd.zonal"],
  ["comparable_lowest", "qd.comp_low"],
  ["comparable_highest", "qd.comp_high"],
  ["comparable_count", "qd.comp_count"],
  ["comparables_gathered", "qd.as_of"],
  ["commission", "qd.commission"],
  ["market_insight", "qd.mi"],
  ["current_rent", "qd.rent"],
];

/** The text a user saw for a stored answer: the option label, or the value itself (locations). */
export function answerText(value: unknown, entry: FieldEntry | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  const opt = entry?.options?.find((o) => String(o.value) === String(value));
  if (opt) return opt.label;
  if (value === true) return "Yes";
  if (value === false) return "No";
  return String(value);
}

/** Short, readable reference sent as report_id, e.g. QR-20261028-7FEF3E98. */
export function quickReportRef(reportId: string, today: string) {
  return `QR-${today.replace(/-/g, "")}-${reportId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** The 21 pipeline inputs for one run. */
export function quickReportInputs(intake: Record<string, unknown>, opts: { reportRef: string; today: string }) {
  const dict = fieldDictionary("quick_report");
  const out: Record<string, string> = {};
  for (const [name, key] of QR_PIPELINE_INPUTS) {
    if (name === "report_id") out[name] = opts.reportRef;
    else if (name === "today") out[name] = opts.today;
    else out[name] = answerText(intake[key!], dict.find((f) => f.key === key));
  }
  return out;
}
