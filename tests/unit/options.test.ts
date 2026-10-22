import { describe, expect, it } from "vitest";
import { fieldDictionary, getOptions, locationTree } from "@/lib/options";
import { validatorFor } from "@/lib/contract/registry";
import { getAjv } from "@/lib/contract/registry";

describe("options catalogue", () => {
  it("every product dictionary validates against node_io FieldDictionary", () => {
    getAjv();
    const v = getAjv().compile({ $ref: "https://schemas.grid.ph/feasibility-studio/v1/node_io.schema.json#/$defs/FieldDictionary" });
    for (const p of ["quick_report", "executive_summary", "feasibility_report"] as const) {
      expect(v(fieldDictionary(p)), `${p}: ${JSON.stringify(v.errors?.slice(0, 2))}`).toBe(true);
    }
    expect(validatorFor).toBeTypeOf("function");
  });
  it("Quick Report fields are choices or location text only (no free numbers, AC-023)", () => {
    for (const f of fieldDictionary("quick_report")) {
      if (f.key.startsWith("property.") && f.type === "text") continue; // location pickers
      expect(f.type, f.key).toBe("choice");
    }
  });
  it("has a three-level location tree", () => {
    const t = locationTree();
    expect(t["NCR"]?.["Metro Manila"]).toContain("Taguig");
    expect(getOptions("quick_report").locations).toBe(t);
  });
});
