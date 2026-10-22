/**
 * Quick Report form (BRD v2.0 S-03 / v1.1 S-05; prototype QSTEPS). Dropdowns only (AC-023): every
 * field is a choice from the field dictionary or the location tree. Required: location, lot area,
 * asking price and the comparable range (prototype `missing`).
 */
import { isShown, type FormDefinition, type FormContext, type Intake, type Issue, type ValidationResult } from "./types";

export const quickReportForm: FormDefinition = {
  product: "quick_report",
  steps: [
    {
      key: "property",
      title: "Property",
      lede: "Location and size, from the listing and the site visit.",
      fields: [
        { key: "property.region", label: "Region", required: true, kind: "location.region" },
        { key: "property.province", label: "Province", required: true, kind: "location.province" },
        { key: "property.city", label: "City or municipality", required: true, kind: "location.city" },
        { key: "property.road_access", label: "Road access" },
        { key: "qd.lot_area", label: "Lot area", required: true },
        { key: "qd.floor_area", label: "Building on site" },
      ],
    },
    {
      key: "client",
      title: "Client and papers",
      lede: "What the client wants and which papers you already hold.",
      fields: [
        { key: "use.goal", label: "Client's goal" },
        { key: "owner.type", label: "Client type" },
        { key: "qd.title_copy", label: "Title (TCT/CCT) copy" },
        { key: "qd.tax_dec", label: "Tax declaration copy" },
      ],
    },
    {
      key: "price",
      title: "Price and comparables",
      lede: "Your listing work: the asking price, the comparable listings you checked and the BIR zonal value.",
      note: "Comparables are asking prices from listings, not closed sales, and the report labels them that way.",
      fields: [
        { key: "qd.ask_psqm", label: "Asking price per sqm", required: true },
        { key: "qd.zonal", label: "BIR zonal value" },
        { key: "qd.comp_low", label: "Comparable listings, lowest", required: true },
        { key: "qd.comp_high", label: "Comparable listings, highest", required: true },
        { key: "qd.comp_count", label: "How many comparables" },
        { key: "qd.as_of", label: "When you gathered them" },
        { key: "qd.commission", label: "Commission" },
        { key: "qd.mi", label: "Market Insight" },
        { key: "qd.rent", label: "Current or asking rent", showWhen: { key: "qd.floor_area", notIn: [0] } },
      ],
    },
  ],
};

/** Items brokers usually cannot provide: listed on Review as the upgrade path (v1.1 S-05 rule 5). */
export const quickReportNotAsked = [
  "Broker estimates: build cost, saleable or leasable areas, sales pace, occupancy",
  "Owner-only items: target return, funding, tax, operating costs, valuation, permits",
];

function optionValues(ctx: FormContext, key: string) {
  return ctx.fields.find((f) => f.key === key)?.options?.map((o) => String(o.value)) ?? null;
}

/** Validates and cleans a Quick Report intake. Unknown keys and hidden fields are dropped. */
export function validateQuickReport(raw: Intake, ctx: FormContext): ValidationResult {
  const issues: Issue[] = [];
  const intake: Intake = {};
  const region = raw["property.region"];
  const province = raw["property.province"];
  const city = raw["property.city"];

  for (const step of quickReportForm.steps) {
    for (const f of step.fields) {
      if (!isShown(f, raw)) continue;
      const v = raw[f.key];
      const empty = v === undefined || v === null || v === "";
      if (empty) {
        if (f.required) issues.push({ key: f.key, label: f.label, step: step.key, message: `Choose ${f.label.toLowerCase()}.` });
        continue;
      }
      let allowed: string[] | null = null;
      if (f.kind === "location.region") allowed = Object.keys(ctx.locations);
      else if (f.kind === "location.province") allowed = Object.keys(ctx.locations[String(region)] ?? {});
      else if (f.kind === "location.city") allowed = ctx.locations[String(region)]?.[String(province)] ?? [];
      else allowed = optionValues(ctx, f.key);
      if (allowed && !allowed.includes(String(v))) {
        issues.push({ key: f.key, label: f.label, step: step.key, message: `Choose ${f.label.toLowerCase()} from the list.` });
        continue;
      }
      intake[f.key] = typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && !f.kind ? Number(v) : v;
    }
  }

  const low = Number(intake["qd.comp_low"]);
  const high = Number(intake["qd.comp_high"]);
  if (intake["qd.comp_low"] !== undefined && intake["qd.comp_high"] !== undefined && high < low) {
    issues.push({
      key: "qd.comp_high",
      label: "Comparable listings, highest",
      step: "price",
      message: "The highest comparable must be the same as or more than the lowest.",
    });
  }
  void city;
  return { ok: issues.length === 0, issues, intake };
}
