import { describe, expect, it } from "vitest";
import { validateIntake } from "@/lib/forms";
import { quickReportForm } from "@/lib/forms/quick-report";
import { fieldDictionary } from "@/lib/options";

const good = {
  "property.region": "NCR",
  "property.province": "Metro Manila",
  "property.city": "Taguig",
  "qd.lot_area": 15000,
  "qd.floor_area": 0,
  "qd.ask_psqm": 40000,
  "qd.comp_low": 30000,
  "qd.comp_high": 50000,
};

describe("Quick Report form", () => {
  it("every field exists in the field dictionary as a dropdown (AC-023)", () => {
    const dict = fieldDictionary("quick_report");
    for (const s of quickReportForm.steps)
      for (const f of s.fields) {
        const entry = dict.find((d) => d.key === f.key);
        expect(entry, f.key).toBeTruthy();
        if (!f.kind) expect(entry!.options?.length, f.key).toBeGreaterThan(0);
      }
  });
  it("accepts a complete intake and normalises numbers", () => {
    const r = validateIntake("quick_report", { ...good, "qd.lot_area": "15000", extra: "dropped" })!;
    expect(r.ok).toBe(true);
    expect(r.intake["qd.lot_area"]).toBe(15000);
    expect(r.intake).not.toHaveProperty("extra");
  });
  it("lists every missing required field (AC-024)", () => {
    const r = validateIntake("quick_report", {})!;
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.key)).toEqual([
      "property.region", "property.province", "property.city", "qd.lot_area", "qd.ask_psqm", "qd.comp_low", "qd.comp_high",
    ]);
  });
  it("refuses a highest comparable below the lowest", () => {
    const r = validateIntake("quick_report", { ...good, "qd.comp_low": 50000, "qd.comp_high": 30000 })!;
    expect(r.issues.map((i) => i.key)).toEqual(["qd.comp_high"]);
  });
  it("refuses values that are not in the lists and cities outside the province", () => {
    const r = validateIntake("quick_report", { ...good, "qd.lot_area": 12345, "property.city": "Cebu City" })!;
    expect(r.issues.map((i) => i.key).sort()).toEqual(["property.city", "qd.lot_area"]);
  });
  it("drops rent when there is no building (hidden field is not sent)", () => {
    expect(validateIntake("quick_report", { ...good, "qd.rent": 500 })!.intake).not.toHaveProperty("qd.rent");
    const withBuilding = validateIntake("quick_report", { ...good, "qd.floor_area": 500, "qd.rent": 500 })!;
    expect(withBuilding.intake["qd.rent"]).toBe(500);
  });
});
