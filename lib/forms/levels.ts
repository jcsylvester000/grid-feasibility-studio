/**
 * Input levels, financial model and expected coverage for the Executive Summary and Feasibility Report
 * forms (BRD v1.1 S-06/S-07; prototype engine.js inputLevel, finMissing, unlocks). Pure functions,
 * used by the form (meter and Review) and by the RunRequest (run_context.input_level).
 */
import type { Intake } from "./types";

export type FinModel = "sale" | "lease" | "landbank";
export type LevelCode =
  | "L0_location_only"
  | "L1_property_and_use"
  | "L2_plus_owner_profile"
  | "L3_plus_cost_and_funding"
  | "L4_plus_professional_reports";

export const LEVEL_CODES: LevelCode[] = [
  "L0_location_only",
  "L1_property_and_use",
  "L2_plus_owner_profile",
  "L3_plus_cost_and_funding",
  "L4_plus_professional_reports",
];

export const LEVEL_LABELS = [
  "Location only",
  "Property and use",
  "Plus owner profile",
  "Plus cost and funding",
  "Plus professional reports",
];

/** Financial model per intended use (prototype options.js intendedUses[].model). */
const USE_MODEL: Record<string, FinModel> = {
  residential_subdivision: "sale",
  residential_condominium: "sale",
  commercial: "lease",
  mixed_use: "sale",
  industrial_warehouse: "lease",
  hospitality_resort: "lease",
  agricultural: "lease",
  institutional: "lease",
  land_banking: "landbank",
};

export const MODEL_LABEL: Record<FinModel, string> = {
  sale: "Develop and sell",
  lease: "Develop and lease, with exit at the end of the hold",
  landbank: "Land bank: hold and resell",
};

const num = (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const has = (v: unknown) => (num(v) ?? 0) > 0;
const set = (v: unknown) => num(v) !== null;
const filled = (v: unknown) => v !== undefined && v !== null && v !== "";

/** The owner's goal decides the model; "joint venture" and "undecided" follow the intended use. */
export function finModel(intake: Intake): FinModel {
  const g = intake["use.goal"];
  if (g === "sell") return "sale";
  if (g === "lease") return "lease";
  if (g === "land_bank") return "landbank";
  return USE_MODEL[String(intake["use.intended_use"] ?? "")] ?? "sale";
}

/** Feasibility Report: what is still missing for L3 (capability names, as the prototype). */
export function finMissing(intake: Intake): string[] {
  if (intake["fin.enabled"] !== true) return ["development_cost", "land_cost", "funding_structure", "unit_mix_and_pricing", "timeline"];
  const m = finModel(intake);
  const f = (k: string) => intake[`fin.${k}`];
  const miss: string[] = [];
  if (!has(f("land_cost"))) miss.push("land_cost");
  if (m !== "landbank" && !has(f("build_cost"))) miss.push("development_cost");
  if (m === "sale") {
    if (!has(f("sellable_area")) || !has(f("price_per_sqm"))) miss.push("unit_mix_and_pricing");
    if (!has(f("absorption_months")) || !has(f("construction_months"))) miss.push("timeline");
  }
  if (m === "lease") {
    if (!has(f("leasable_area")) || !has(f("rent_per_sqm_month"))) miss.push("unit_mix_and_pricing");
    if (!has(f("construction_months"))) miss.push("timeline");
    if (!has(f("occupancy"))) miss.push("operating_assumptions");
  }
  if (m === "landbank" && !set(f("appreciation"))) miss.push("operating_assumptions");
  if (!set(f("equity_pct"))) miss.push("funding_structure");
  return miss;
}

/** Executive Summary: the headline costs (land, build unless land bank, price or rent) count as L3. */
export function headlineCostsMissing(intake: Intake): string[] {
  const m = finModel(intake);
  const miss: string[] = [];
  if (!has(intake["fin.land_cost"])) miss.push("land_cost");
  if (m !== "landbank" && !has(intake["fin.build_cost"])) miss.push("development_cost");
  if (m === "sale" && !has(intake["fin.price_per_sqm"])) miss.push("unit_mix_and_pricing");
  if (m === "lease" && !has(intake["fin.rent_per_sqm_month"])) miss.push("unit_mix_and_pricing");
  return miss;
}

export type LevelInfo = { n: number; code: LevelCode | null; label: string };

/** Document types present (from the uploaded files' tags). */
export type DocSet = Partial<Record<string, boolean>>;

export function inputLevel(product: string, intake: Intake, docs: DocSet = {}): LevelInfo {
  const L0 = filled(intake["property.city"]);
  const L1 = L0 && has(intake["property.lot_area"]) && filled(intake["use.intended_use"]);
  const L2 = L1 && filled(intake["owner.type"]) && filled(intake["use.goal"]);
  const costs = product === "executive_summary" ? headlineCostsMissing(intake) : finMissing(intake);
  const L3 = L2 && costs.length === 0;
  const L4 = L3 && !!docs.title_documents && !!docs.zoning_certificate && (!!docs.site_survey || !!docs.geotechnical_report);
  const n = L4 ? 4 : L3 ? 3 : L2 ? 2 : L1 ? 1 : L0 ? 0 : -1;
  return { n, code: n >= 0 ? LEVEL_CODES[n]! : null, label: n >= 0 ? `L${n}` : "—" };
}

/** What the next level needs, in plain words. */
export function nextLevelHint(product: string, intake: Intake, docs: DocSet = {}): string | null {
  const lv = inputLevel(product, intake, docs).n;
  if (lv < 0) return "Choose the region, province and city.";
  if (lv === 0) return "Add the lot area and the intended use to reach L1.";
  if (lv === 1) return "Add the owner type and the owner's goal to reach L2.";
  if (lv === 2)
    return product === "executive_summary"
      ? "Add the headline costs (land, build, and price or rent) to reach L3."
      : "Switch on cost and funding figures and complete them to reach L3.";
  if (lv === 3) return "Upload the title, the zoning certificate and a survey or geotechnical report to reach L4.";
  return null;
}

export type Coverage = "complete" | "partial" | "inputs_required";

/** Executive Summary: the 11 items and what this intake will let the page say (Review, v1.1 S-06 rule 3). */
export function summaryCoverage(intake: Intake, docs: DocSet = {}): { key: string; label: string; coverage: Coverage }[] {
  const lv = inputLevel("executive_summary", intake, docs).n;
  const known = (k: string) => filled(intake[k]) && intake[k] !== "unknown";
  return [
    { key: "project_description", label: "Project description", coverage: lv >= 1 ? "complete" : "partial" },
    { key: "company_developer", label: "Company or developer", coverage: filled(intake["owner.type"]) ? "complete" : "inputs_required" },
    { key: "goals_objectives", label: "Goals and objectives", coverage: filled(intake["use.goal"]) ? "complete" : filled(intake["use.intended_use"]) ? "partial" : "inputs_required" },
    { key: "location_analysis", label: "Location", coverage: lv >= 0 ? "complete" : "inputs_required" },
    { key: "market_analysis", label: "Market", coverage: has(intake["market.asking_low"]) || intake["market.has_mi"] === "yes" ? "complete" : "partial" },
    { key: "technical_study", label: "Technical study", coverage: known("zoning_answer") || docs.zoning_certificate ? "complete" : "partial" },
    { key: "socio_economic", label: "Socio-economic", coverage: lv >= 0 ? "complete" : "inputs_required" },
    { key: "environmental", label: "Environmental", coverage: known("hazard_answer") || docs.environmental_permits || docs.geotechnical_report ? "complete" : "partial" },
    { key: "financial_projection", label: "Financial projection", coverage: lv >= 3 ? "complete" : "inputs_required" },
    { key: "findings_recommendation", label: "Findings and recommendation", coverage: lv >= 3 ? "complete" : "partial" },
    { key: "conclusion", label: "Conclusion", coverage: lv >= 3 ? "complete" : "partial" },
  ];
}

/** Feasibility Report: the 13 sections and expected coverage, plus the verdict ceiling (v1.1 S-07 rule 4). */
export function reportCoverage(intake: Intake, docs: DocSet = {}) {
  const lv = inputLevel("feasibility_report", intake, docs).n;
  const known = (k: string) => filled(intake[k]) && intake[k] !== "unknown";
  const s = (number: number, label: string, coverage: Coverage) => ({ number, label, coverage });
  const sections = [
    s(1, "Introduction", "complete"),
    s(2, "Project description", lv >= 1 ? "complete" : "partial"),
    s(3, "Feasibility criteria", lv >= 3 ? "complete" : "partial"),
    s(4, "Marketing plan", has(intake["market.asking_low"]) || intake["market.has_mi"] === "yes" ? "complete" : "partial"),
    s(5, "Technical study", known("zoning_answer") || docs.zoning_certificate ? "complete" : "partial"),
    s(6, "Socio-economic and political study", "complete"),
    s(7, "Environmental", known("hazard_answer") || docs.environmental_permits || docs.geotechnical_report ? "complete" : "partial"),
    s(8, "Organizational management", lv >= 2 ? "partial" : "inputs_required"),
    s(9, "Risk and sensitivity", lv >= 3 ? "complete" : "partial"),
    s(10, "Methodology and limitations", "complete"),
    s(11, "Findings and recommendations", lv >= 3 ? "complete" : "partial"),
    s(12, "Conclusion", lv >= 3 ? "complete" : "partial"),
    s(13, "Annex (sources and financial statements)", lv >= 3 ? "complete" : "partial"),
  ];
  const ceiling =
    lv >= 3
      ? "A verdict is possible (feasible, conditionally feasible or not feasible)."
      : "No verdict below L3: the report will say “insufficient data” and list what is needed.";
  return { sections, financials: lv >= 3 ? ("complete" as Coverage) : ("inputs_required" as Coverage), ceiling, level: lv };
}

export const COVERAGE_TEXT: Record<Coverage, string> = { complete: "Complete", partial: "Partial", inputs_required: "Inputs required" };
