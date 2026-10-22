/**
 * Builds the RunRequest sent to every pipeline (VS-02; run_request.schema.json 1.0).
 * The input level and verdict ceiling follow the blueprint's input gate: they are computed from which
 * capabilities (field dictionary `capability`) the intake provides.
 */
import type { Product } from "@/lib/db/schema";
import { EXPECTED_SCHEMA } from "@/lib/contract/validate";
import { fieldDictionary, type FieldEntry } from "@/lib/options";
import { inputLevel as formLevel } from "@/lib/forms/levels";

export const FRONT_END_VERSION = "web 0.4.0";

export type InputLevel =
  | "L0_location_only"
  | "L1_property_and_use"
  | "L2_plus_owner_profile"
  | "L3_plus_cost_and_funding"
  | "L4_plus_professional_reports";

const COST_CAPS = ["land_cost", "development_cost", "unit_mix_and_pricing", "funding_structure"];
const REPORT_CAPS = ["site_survey", "geotechnical_report", "environmental_permits", "zoning_certificate"];

/** Capabilities the intake provides (a value that is present and not an "unknown" option). */
export function providedCapabilities(intake: Record<string, unknown>, dict: FieldEntry[]) {
  const caps = new Set<string>();
  for (const f of dict) {
    if (!f.capability) continue;
    const v = intake[f.key];
    if (v === undefined || v === null || v === "") continue;
    const opt = f.options?.find((o) => String(o.value) === String(v));
    if (opt?.means_unknown) continue;
    caps.add(f.capability);
  }
  // Quick Report keys (qd.*) carry their meaning via maps_from.
  if (intake["qd.lot_area"]) caps.add("lot_area");
  return caps;
}

export function inputLevel(caps: Set<string>, documents = 0): InputLevel {
  if (!caps.has("location") || !caps.has("lot_area")) return "L0_location_only";
  if (!caps.has("intended_use") && !caps.has("goals_objectives")) return "L0_location_only";
  if (!caps.has("owner_developer_profile")) return "L1_property_and_use";
  if (!COST_CAPS.every((c) => caps.has(c))) return "L2_plus_owner_profile";
  if (documents === 0 && !REPORT_CAPS.some((c) => caps.has(c))) return "L3_plus_cost_and_funding";
  return "L4_plus_professional_reports";
}

/** AI nodes per pipeline (DAG files, prompt pack v1.2.0). */
const ENABLED_NODES: Record<Product, string[]> = {
  quick_report: ["Q02_market_snapshot", "Q06_one_page_writer", "Q07_qa"],
  executive_summary: ["E03_gap_research", "E04_merge_fact_check", "E05_one_page_writer", "E06_qa"],
  feasibility_report: ["N02_planner", "N03_document_extraction", "N04_location", "N05_market", "N06_technical", "N07_socio", "N08_environment", "N09_track_record", "N11_fact_check", "N13_section_writers", "N15_findings", "N16_qa", "N17_executive_summary"],
  teaser_intake: ["T02_read_teaser", "T03_video", "T04_extract", "T06_locate", "T07_claims", "T08_review"],
};

function verdictCeiling(product: Product, level: InputLevel, complete: boolean) {
  if (product === "quick_report") return complete ? "promising" : "cannot_tell";
  if (level === "L3_plus_cost_and_funding" || level === "L4_plus_professional_reports") return "conditionally_feasible";
  return "insufficient_data";
}

/** Today's date in Asia/Manila as YYYY-MM-DD. */
export function manilaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type RunDocument = { doc_ref: string; file_name: string; mime: string; url: string; expires_at: string; user_label?: string; capability?: string };

export function buildRunRequest(opts: {
  product: Product;
  reportId: string;
  attempt: number;
  intake: Record<string, unknown>;
  complete: boolean;
  userPublicId: string;
  appOrigin: string;
  documents?: RunDocument[];
  now?: Date;
}) {
  const dict = fieldDictionary(opts.product);
  const caps = providedCapabilities(opts.intake, dict);
  // Executive Summary and Feasibility Report: the form's level rules (lib/forms/levels.ts), so the meter
  // the user saw and the level the pipeline receives agree.
  const docs = Object.fromEntries((opts.documents ?? []).filter((d) => d.capability).map((d) => [d.capability!, true]));
  const level: InputLevel =
    opts.product === "executive_summary" || opts.product === "feasibility_report"
      ? (formLevel(opts.product, opts.intake, docs).code ?? "L0_location_only")
      : inputLevel(caps, opts.documents?.length ?? 0);
  return {
    request_version: "1.0" as const,
    product: opts.product,
    report_id: opts.reportId,
    idempotency_key: `rpt_${opts.reportId}_run${opts.attempt}`,
    schema_version: EXPECTED_SCHEMA[opts.product],
    run_context: {
      report_id: opts.reportId,
      product: opts.product,
      tier: "desk",
      today: manilaDate(opts.now),
      market: { country: "PH", currency: "PHP", locale: "en-PH" },
      input_level: level,
      verdict_ceiling: verdictCeiling(opts.product, level, opts.complete),
      enabled_nodes: ENABLED_NODES[opts.product],
      pre_limitations: [],
      front_end_version: FRONT_END_VERSION,
    },
    field_dictionary: dict,
    intake: opts.intake,
    documents: opts.documents ?? [],
    // Required by run_request 1.x (written for the v1.1 webhook design). VectorShift does not call it;
    // the app holds the run call open instead (BRD v2.0 7.3). Ledger GFS-05.
    callback: { url: `${opts.appOrigin.replace(/\/$/, "")}/api/runs/callback`, events: ["run.succeeded", "run.failed"] },
    requested_by: { user_id: opts.userPublicId, role: "user" },
  };
}
