/** Quick Report screen computed by code (rating rule and key figures) and the live output reader. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quickScreen } from "@/lib/report/quick-screen";
import { normaliseLive, readSummary } from "@/lib/vectorshift/quick-report-live";

// Batangas City run, 28 Oct 2026 (answers as stored: option values).
const BATANGAS = {
  "qd.lot_area": 4000, "qd.floor_area": 3000, "qd.ask_psqm": 2500, "qd.zonal": 3000, "qd.comp_low": 1500, "qd.comp_high": 7000,
  "qd.comp_count": 2, "qd.as_of": 0, "qd.commission": 3, "qd.rent": 2500, "qd.title_copy": "no", "qd.tax_dec": "no",
};
const fig = (s: ReturnType<typeof quickScreen>, k: string) => s.figures.find((f) => f.key === k)?.value;

describe("quick screen (code, not the language model)", () => {
  it("inside the comparable range is Marginal, whatever the pipeline said", () => {
    const s = quickScreen(BATANGAS);
    expect(s.rating).toBe("marginal");
    expect(s.headline).toContain("inside the comparable range of ₱1,500/sqm to ₱7,000/sqm");
    expect(s.headline).toContain("Few comparables");
  });

  it("computes the key figures correctly", () => {
    const s = quickScreen(BATANGAS);
    expect(fig(s, "total")).toBe("₱10,000,000");
    expect(fig(s, "vs_low")).toBe("+66.7%");
    expect(fig(s, "vs_high")).toBe("−64.3%");
    expect(fig(s, "vs_mid")).toBe("−41.2%");
    expect(fig(s, "vs_zonal")).toBe("0.83×");
    expect(fig(s, "zonal_total")).toBe("₱12,000,000");
    expect(fig(s, "commission")).toBe("₱300,000");
    expect(fig(s, "proceeds")).toBe("₱9,700,000");
    expect(fig(s, "rent_month")).toBe("₱7,500,000");
    expect(fig(s, "gross_yield")).toBe("900%");
  });

  it("flags missing papers, a price below zonal and thin comparables", () => {
    const keys = quickScreen(BATANGAS).checks.map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining(["app_no_title", "app_no_tax_dec", "app_below_zonal", "app_few_comps", "app_asking"]));
  });

  it("below the low is Promising, above the high is Weak, missing range is Can't tell", () => {
    expect(quickScreen({ ...BATANGAS, "qd.ask_psqm": 1000 }).rating).toBe("promising");
    expect(quickScreen({ ...BATANGAS, "qd.ask_psqm": 9000 }).rating).toBe("weak");
    expect(quickScreen({ "qd.ask_psqm": 2500 }).rating).toBe("cannot_tell");
  });
});

describe("live output reader: nested shapes from the live pipeline", () => {
  const fx = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/live-quick-report-nested.json`, "utf8"));
  const r = normaliseLive(fx);
  if (!r.ok) throw new Error("normalise failed");
  const v = r.value;

  it("reads checks nested in an object", () => {
    expect(v.checks.map((c) => c.key)).toEqual(["zonal_checked", "rent_outlier"]);
  });

  it("reads source objects, numbered by citation, and drops unsafe links", () => {
    expect(v.sources.map((s) => s.n)).toEqual([1, 2]);
    expect(v.sources[0]!.url).toBe("https://example.com/listing-a");
  });

  it("reads the market snapshot in question order, with evidence, facts and notes", () => {
    expect(v.snapshotDate).toBe("2026-10-28");
    expect(v.snapshot.map((q) => q.id)).toEqual(["q1_market_land_price_evidence", "q2_current_leasing_evidence", "q3_location_demand_and_access_evidence", "q4_development_and_validation_items"]);
    const q1 = v.snapshot[0]!;
    expect(q1.title).toBe("Market land price evidence");
    expect(q1.evidence[0]).toMatchObject({ source: "Example portal", cites: [2] });
    // The broker's own figures are not repeated (they are under "What this screen used").
    expect(q1.facts).toEqual([]);
    expect(v.snapshot[3]!.title).toBe("Development and validation items");
    expect(v.snapshot[3]!.facts).toEqual(expect.arrayContaining([{ label: "Title copy available", value: "No" }]));
    expect(v.snapshot[3]!.bullets[0]).toContain("Industrial parks");
  });

  it("writes acronyms in capitals", async () => {
    const { humanizeKey, formatKeyed } = await import("@/lib/vectorshift/quick-report-live");
    expect(humanizeKey("bir_zonal_value_per_sqm_php")).toBe("BIR zonal value per sqm");
    expect(formatKeyed("range_php", { low: 1500, high: 7000 })).toBe("₱1,500 – ₱7,000");
  });

  it("recovers the headline and complete notes from a cut-off JSON summary", () => {
    expect(v.summary).toMatchObject({ truncated: true });
    expect(v.summary!.headline).toContain("Promising, worth a full study");
    expect(v.summary!.notes).toHaveLength(2);
    expect(readSummary("Plain text summary.")).toEqual({ headline: "", notes: ["Plain text summary."], truncated: false });
    expect(readSummary('{"headline":"H","notes":["a","b"]}')).toEqual({ headline: "H", notes: ["a", "b"], truncated: false });
  });
});
