/** Executive Summary and Feasibility Report forms (S-03; v1.1 S-06/S-07 rules), levels and coverage. */
import { describe, expect, it } from "vitest";
import { getOptions } from "@/lib/options";
import { executiveSummaryForm, feasibilityReportForm, validateExecutiveSummary, validateFeasibilityReport } from "@/lib/forms/full-reports";
import { finModel, inputLevel, reportCoverage, summaryCoverage } from "@/lib/forms/levels";
import { isShown } from "@/lib/forms/types";
import { checkFile } from "@/lib/files/config";

const es = getOptions("executive_summary");
const fr = getOptions("feasibility_report");
const base = { "property.region": "NCR", "property.province": "Metro Manila", "property.city": "Taguig", "property.lot_area": "14323", "use.intended_use": "industrial_warehouse" };
const shownKeys = (intake: Record<string, unknown>) =>
  feasibilityReportForm.steps.find((s) => s.key === "costs")!.fields.filter((f) => isShown(f, intake)).map((f) => f.key);

describe("form definitions", () => {
  it("every field is in the product's field dictionary (except the cost switch)", () => {
    for (const [form, opts] of [[executiveSummaryForm, es], [feasibilityReportForm, fr]] as const) {
      const keys = new Set(opts.fields.map((f) => f.key));
      for (const s of form.steps) for (const f of s.fields) if (f.key !== "fin.enabled") expect(keys.has(f.key), `${form.product} ${f.key}`).toBe(true);
    }
  });

  it("the Executive Summary has no Market Insight picker (deferred, BRD v2.0)", () => {
    expect(executiveSummaryForm.steps.flatMap((s) => s.fields.map((f) => f.key))).not.toContain("market.has_mi");
  });
});

describe("Feasibility Report costs step", () => {
  it("industrial warehouse uses the lease model: lease fields show, sale-only fields are hidden (v1.1 AC-032)", () => {
    const intake = { ...base, "fin.enabled": true };
    expect(finModel(intake)).toBe("lease");
    const keys = shownKeys(intake);
    expect(keys).toEqual(expect.arrayContaining(["fin.leasable_area", "fin.rent_per_sqm_month", "fin.occupancy", "fin.exit_cap"]));
    expect(keys).not.toContain("fin.sellable_area");
    expect(keys).not.toContain("fin.absorption_months");
    expect(shownKeys({ ...base, "use.goal": "sell", "fin.enabled": true })).toContain("fin.sellable_area");
    expect(shownKeys({ ...base, "use.goal": "land_bank", "fin.enabled": true })).toContain("fin.appreciation");
    expect(shownKeys(base)).toEqual(["fin.enabled"]);
  });

  it("with the cost switch on and only land cost, the step lists every missing field (v1.1 AC-033)", () => {
    const r = validateFeasibilityReport({ ...base, toc_mode: "summary_first", "use.goal": "lease", "fin.enabled": true, "fin.land_cost": "601566000" }, fr);
    const costs = r.issues.filter((i) => i.step === "costs").map((i) => i.key);
    expect(costs).toEqual(["fin.build_cost", "fin.leasable_area", "fin.rent_per_sqm_month", "fin.occupancy", "fin.construction_months", "fin.equity_pct"]);
  });

  it("cleans numbers, drops hidden fields and rejects bad values", () => {
    const r = validateFeasibilityReport({ ...base, toc_mode: "summary_first", "use.goal": "lease", "fin.sellable_area": "100", "property.lot_area": "-5", "market.as_of": "yesterday" }, fr);
    expect(r.intake["fin.sellable_area"]).toBeUndefined();
    expect(r.issues.map((i) => i.key)).toEqual(expect.arrayContaining(["property.lot_area", "market.as_of"]));
    const ok = validateFeasibilityReport({ ...base, toc_mode: "summary_first", "use.goal": "lease", "use.detail": "Bulk warehouse" }, fr);
    expect(ok.intake["property.lot_area"]).toBe(14323);
  });

  it("asking high below low is refused", () => {
    const r = validateExecutiveSummary({ ...base, "market.asking_low": "50000", "market.asking_high": "30000" }, es);
    expect(r.issues.map((i) => i.key)).toContain("market.asking_high");
  });
});

describe("input levels and coverage", () => {
  const lease = {
    ...base,
    "owner.type": "family_corp",
    "use.goal": "lease",
    "fin.enabled": true,
    "fin.land_cost": 601566000,
    "fin.build_cost": 212000000,
    "fin.leasable_area": 8000,
    "fin.rent_per_sqm_month": 450,
    "fin.occupancy": 90,
    "fin.construction_months": 12,
    "fin.equity_pct": 40,
  };
  it("L0 to L4 follow the prototype gate", () => {
    expect(inputLevel("feasibility_report", {}).n).toBe(-1);
    expect(inputLevel("feasibility_report", { "property.city": "Taguig" }).code).toBe("L0_location_only");
    expect(inputLevel("feasibility_report", base).code).toBe("L1_property_and_use");
    expect(inputLevel("feasibility_report", { ...base, "owner.type": "family_corp", "use.goal": "lease" }).code).toBe("L2_plus_owner_profile");
    expect(inputLevel("feasibility_report", lease).code).toBe("L3_plus_cost_and_funding");
    expect(inputLevel("feasibility_report", lease, { title_documents: true, zoning_certificate: true, site_survey: true }).code).toBe("L4_plus_professional_reports");
  });

  it("Executive Summary without costs: financial projection 'inputs required', level L2 or below (v1.1 AC-029)", () => {
    const intake = { ...base, "owner.type": "family_corp", "use.goal": "lease" };
    expect(inputLevel("executive_summary", intake).n).toBeLessThanOrEqual(2);
    expect(summaryCoverage(intake).find((i) => i.key === "financial_projection")?.coverage).toBe("inputs_required");
    const withCosts = { ...intake, "fin.land_cost": 1, "fin.build_cost": 1, "fin.rent_per_sqm_month": 450 };
    expect(inputLevel("executive_summary", withCosts).n).toBe(3);
    expect(summaryCoverage(withCosts)).toHaveLength(11);
  });

  it("Feasibility Report: no verdict below L3", () => {
    expect(reportCoverage(base).ceiling).toMatch(/No verdict below L3/);
    expect(reportCoverage(lease).ceiling).toMatch(/verdict is possible/);
    expect(reportCoverage(lease).sections).toHaveLength(13);
  });
});

describe("file checks (BRD 9)", () => {
  it("type, size and count", () => {
    expect(checkFile({ name: "a.pdf", size: 25 * 1024 * 1024, type: "application/pdf" }, 1)).toBeNull();
    expect(checkFile({ name: "a.pdf", size: 25 * 1024 * 1024 + 1, type: "application/pdf" }, 1)).toBe("Files must be 25 MB or smaller");
    expect(checkFile({ name: "a.docx", size: 10, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }, 1)).toBe("Use a PDF, JPG, PNG or HEIC file");
    expect(checkFile({ name: "a.jpg", size: 10, type: "image/jpeg" }, 11)).toBe("Up to 10 files per report");
  });
});
