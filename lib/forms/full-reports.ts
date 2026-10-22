/**
 * Executive Summary and Feasibility Report forms (BRD v2.0 S-03; v1.1 S-06 and S-07; prototype STEPS).
 * Keys are field dictionary keys; labels follow the prototype. The Market Insight picker is deferred for
 * the Executive Summary (BRD v2.0). Costs show by financial model (sale, lease, land bank).
 */
import { validateForm } from "./engine";
import type { Cond, FormContext, FormDefinition, FormField, FormStep, Intake } from "./types";

const ON: Cond = { key: "fin.enabled", in: [true] };
const req = (...model: ("sale" | "lease" | "landbank")[]): Partial<FormField> => ({ showWhen: [ON, { model }], requiredWhen: [ON, { model }] });
const opt = (...model: ("sale" | "lease" | "landbank")[]): Partial<FormField> => ({ showWhen: [ON, { model }] });

const property = (forReport: boolean): FormStep => ({
  key: "property",
  title: "Property",
  lede: "Where the site is and how big it is. Location alone is input level L0; adding lot area and intended use reaches L1.",
  fields: [
    { key: "property.name", label: "Property or project name", kind: "text", placeholder: "e.g. Riverside lot, Phase 2", wide: true },
    { key: "property.region", label: "Region", required: true, kind: "location.region" },
    { key: "property.province", label: "Province", required: true, kind: "location.province" },
    { key: "property.city", label: "City or municipality", required: true, kind: "location.city" },
    ...(forReport
      ? ([
          { key: "property.barangay", label: "Barangay", kind: "text", placeholder: "Optional" },
          { key: "property.address", label: "Street or landmark", kind: "text", placeholder: "Optional", wide: true },
        ] as FormField[])
      : []),
    { key: "property.road_access", label: "Road access" },
    { key: "property.lot_area", label: "Lot area", kind: "number", unit: "sqm", required: true, hint: "As on the title, if you have it." },
    { key: "property.floor_area", label: "Existing floor area", kind: "number", unit: "sqm", hint: "Leave blank for raw land." },
  ],
});

const intendedUseStep = (goalRequired: boolean): FormStep => ({
  key: "use",
  title: "Use and goals",
  lede: "What the owner wants to do with the site. This sets the financial model (sale, lease or land bank) and the criteria.",
  fields: [
    { key: "use.intended_use", label: "Intended use", required: true, wide: true },
    { key: "use.detail", label: "Type", groupBy: "use.intended_use", showWhen: { key: "use.intended_use" } },
    { key: "use.goal", label: "Owner's goal", required: goalRequired },
    { key: "use.horizon", label: "Time horizon" },
    { key: "use.target_irr", label: "Target return" },
  ],
});

const market = (withInsight: boolean): FormStep => ({
  key: "market",
  title: "Market evidence",
  optional: true,
  lede: "Price evidence you already have. Listing prices are asking prices, not closed sales, and the report labels them that way.",
  fields: [
    ...(withInsight
      ? ([
          { key: "market.has_mi", label: "Market Insight report" },
          { key: "market.mi_id", label: "Market Insight report ID", kind: "text", placeholder: "e.g. MI-2026-0142", showWhen: { key: "market.has_mi", in: ["yes"] } },
        ] as FormField[])
      : []),
    { key: "market.asking_low", label: "Asking price, low", kind: "number", unit: "PHP/sqm" },
    { key: "market.asking_high", label: "Asking price, high", kind: "number", unit: "PHP/sqm" },
    { key: "market.comps_count", label: "Number of comparable listings", kind: "number", unit: "listings" },
    { key: "market.as_of", label: "Prices as of", kind: "date" },
    { key: "market.zonal_per_sqm", label: "BIR zonal value", kind: "number", unit: "PHP/sqm", hint: "From the BIR zonal value schedule for the street." },
  ],
});

const owner: FormStep = {
  key: "owner",
  title: "Owner or developer",
  optional: true,
  lede: "Who owns the site and who will develop it. Adding the owner type reaches input level L2 and fills the company sections.",
  fields: [
    { key: "owner.name", label: "Owner or developer name", kind: "text", placeholder: "Company or person", wide: true },
    { key: "owner.type", label: "Owner type" },
    { key: "owner.track", label: "Completed projects" },
    { key: "owner.years", label: "Years operating" },
  ],
};

const site = (title: string): FormStep => ({
  key: "documents",
  title,
  optional: true,
  documents: true,
  lede: "Professional documents and what they say. Title, zoning certificate and a survey or geotechnical report reach input level L4.",
  note: "Answers here are recorded as owner input. Values read from an uploaded document are marked “verified document” by the pipeline.",
  fields: [
    { key: "zoning_answer", label: "What does the zoning certificate say?" },
    { key: "hazard_answer", label: "Hazard assessment result" },
  ],
});

const crossChecks = [
  { a: "market.asking_low", b: "market.asking_high", step: "market", label: "Asking price, high", message: "The high asking price must be the same as or more than the low." },
];

export const executiveSummaryForm: FormDefinition = {
  product: "executive_summary",
  crossChecks,
  steps: [
    property(false),
    intendedUseStep(false),
    market(false),
    owner,
    {
      key: "costs",
      title: "Headline costs",
      optional: true,
      lede: "Optional. With the land and build costs and the planned price or rent, the summary can show headline financial figures (L3).",
      fields: [
        { key: "fin.land_cost", label: "Land cost (total)", kind: "number", unit: "PHP" },
        { key: "fin.build_cost", label: "Development or build cost (total)", kind: "number", unit: "PHP", showWhen: { model: ["sale", "lease"] } },
        { key: "fin.price_per_sqm", label: "Planned selling price", kind: "number", unit: "PHP/sqm", showWhen: { model: ["sale"] } },
        { key: "fin.rent_per_sqm_month", label: "Planned rent", kind: "number", unit: "PHP/sqm/month", showWhen: { model: ["lease"] } },
      ],
    },
    site("Documents"),
  ],
};

export const feasibilityReportForm: FormDefinition = {
  product: "feasibility_report",
  crossChecks,
  steps: [
    {
      key: "format",
      title: "Format",
      lede: "How the finished report is ordered. You can change this later and run again.",
      fields: [{ key: "toc_mode", label: "Page order", required: true, wide: true }],
    },
    property(true),
    intendedUseStep(true),
    market(true),
    owner,
    {
      key: "costs",
      title: "Costs and funding",
      optional: true,
      lede: "The numbers only the owner has. With these the financial engine produces the financial statements and a verdict becomes possible (input level L3).",
      fields: [
        { key: "fin.enabled", label: "I have cost and funding figures", kind: "toggle", wide: true, hint: "Without them the report shows “Inputs required” for the financial parts and gives no verdict." },
        { key: "fin.land_cost", label: "Land cost (total)", kind: "number", unit: "PHP", showWhen: ON, requiredWhen: ON },
        { key: "fin.build_cost", label: "Development or build cost (total)", kind: "number", unit: "PHP", ...req("sale", "lease") },
        { key: "fin.build_cost", label: "Improvements, if any", kind: "number", unit: "PHP", ...opt("landbank") },
        { key: "fin.soft_pct", label: "Soft costs (design, permits, fees)", ...opt("sale", "lease") },
        { key: "fin.sellable_area", label: "Sellable area", kind: "number", unit: "sqm", ...req("sale") },
        { key: "fin.price_per_sqm", label: "Planned selling price", kind: "number", unit: "PHP/sqm", ...req("sale") },
        { key: "fin.absorption_months", label: "Sales period", ...req("sale") },
        { key: "fin.leasable_area", label: "Leasable area", kind: "number", unit: "sqm", ...req("lease") },
        { key: "fin.rent_per_sqm_month", label: "Planned rent", kind: "number", unit: "PHP/sqm/month", ...req("lease") },
        { key: "fin.occupancy", label: "Stabilised occupancy", ...req("lease") },
        { key: "fin.opex_pct", label: "Operating costs", ...opt("lease") },
        { key: "fin.escalation", label: "Rent escalation", ...opt("lease") },
        { key: "fin.exit_cap", label: "Exit valuation (cap rate)", ...opt("lease") },
        { key: "fin.appreciation", label: "Expected land appreciation", ...req("landbank") },
        { key: "fin.selling_pct", label: "Selling or exit costs", ...opt("sale", "lease", "landbank") },
        { key: "fin.construction_months", label: "Construction period", ...req("sale", "lease") },
        { key: "fin.equity_pct", label: "Funding split", showWhen: ON, requiredWhen: ON },
        { key: "fin.loan_rate", label: "Loan interest rate", showWhen: ON },
        { key: "fin.discount_rate", label: "Discount rate for NPV", showWhen: ON },
        { key: "fin.tax_rate", label: "Income tax", showWhen: ON },
      ],
    },
    site("Documents and site"),
  ],
};

export const validateExecutiveSummary = (raw: Intake, ctx: FormContext) => validateForm(executiveSummaryForm, raw, ctx);
export const validateFeasibilityReport = (raw: Intake, ctx: FormContext) => validateForm(feasibilityReportForm, raw, ctx);
