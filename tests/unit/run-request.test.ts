import { describe, expect, it } from "vitest";
import { buildRunRequest, inputLevel, manilaDate, providedCapabilities } from "@/lib/runs/run-request";
import { validateRunRequest } from "@/lib/contract/validate";
import { fieldDictionary } from "@/lib/options";

const intake = {
  "property.region": "NCR", "property.province": "Metro Manila", "property.city": "Taguig",
  "qd.lot_area": 15000, "qd.ask_psqm": 40000, "qd.comp_low": 30000, "qd.comp_high": 50000, "use.goal": "sell",
};

describe("RunRequest builder (VS-02)", () => {
  it("builds a request that validates against run_request.schema.json", () => {
    const rr = buildRunRequest({ product: "quick_report", reportId: "6c1f8f7e-0000-4000-8000-000000000001", attempt: 1, intake, complete: true, userPublicId: "U-ABC123", appOrigin: "http://localhost:3000" });
    const v = validateRunRequest(rr);
    expect(v.ok ? [] : v.issues).toEqual([]);
    expect(rr.idempotency_key).toBe("rpt_6c1f8f7e-0000-4000-8000-000000000001_run1");
    expect(rr.run_context.input_level).toBe("L1_property_and_use");
    expect(rr.run_context.verdict_ceiling).toBe("promising");
    expect(rr.field_dictionary.length).toBe(fieldDictionary("quick_report").length);
  });
  it("computes input levels from capabilities", () => {
    const dict = fieldDictionary("quick_report");
    expect(inputLevel(providedCapabilities({ "property.city": "Taguig" }, dict))).toBe("L0_location_only");
    expect(inputLevel(providedCapabilities(intake, dict))).toBe("L1_property_and_use");
    expect(inputLevel(new Set(["location", "lot_area", "intended_use", "owner_developer_profile", "land_cost", "development_cost", "unit_mix_and_pricing", "funding_structure"]))).toBe("L3_plus_cost_and_funding");
  });
  it("uses the Manila date", () => {
    expect(manilaDate(new Date("2026-10-22T17:30:00Z"))).toBe("2026-10-23");
  });
});
