import { describe, expect, it } from "vitest";
import { periodFrom, pipelineWarnings, toCsv } from "@/lib/admin/service";

describe("admin rules", () => {
  it("AC-043: Feasibility Report p95 650 s with a 750 s timeout shows the timeout warning", () => {
    const w = pipelineWarnings({ p95Ms: 650_000, successRate7: 0.99 }, 750_000);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/p95 run time 650 s is above 80% of the 750 s timeout/);
    expect(pipelineWarnings({ p95Ms: 500_000, successRate7: 0.99 }, 750_000)).toEqual([]);
    expect(pipelineWarnings({ p95Ms: null, successRate7: 0.9 }, 750_000)[0]).toMatch(/under 95%/);
  });

  it("periods are Asia/Manila dates; custom ranges are ordered", () => {
    const now = new Date("2026-10-21T17:30:00Z"); // 01:30 on 22 Oct in Manila
    expect(periodFrom({ range: "today" }, now).period).toEqual({ from: "2026-10-22", to: "2026-10-22" });
    expect(periodFrom({}, now).period).toEqual({ from: "2026-09-23", to: "2026-10-22" });
    expect(periodFrom({ range: "custom", from: "2026-10-10", to: "2026-10-01" }, now).period).toEqual({ from: "2026-10-01", to: "2026-10-10" });
  });

  it("CSV cells are quoted and spreadsheet formulas neutralised", () => {
    expect(toCsv(["a", "b"], [["x,y", "=HYPERLINK(1)"]])).toBe('a,b\r\n"x,y",\'=HYPERLINK(1)\r\n');
  });
});
