import { describe, expect, it } from "vitest";
import { formatFigure, formatMetric, formatRange, formatValue, num, peso } from "@/lib/report/format";

const fig = (value: number | null, unit: string, extra = {}) => ({ value, range: null, unit, as_of: null, status: "computed", source_ids: [], ...extra });

describe("report number formatting (BRD 8.1 rule 5)", () => {
  it("formats pesos and peso rates from the sample reports", () => {
    expect(peso(601566000)).toBe("₱601,566,000");
    expect(peso(-429592892.25)).toBe("−₱429,592,892");
    expect(peso(450)).toBe("₱450");
    expect(peso(12.5)).toBe("₱12.5");
    expect(formatValue(42000, "PHP/sqm")).toBe("₱42,000/sqm");
    expect(formatValue(450, "PHP/sqm/month")).toBe("₱450/sqm/month");
    expect(formatValue(44520853.33, "PHP per year")).toBe("₱44,520,853 per year");
  });
  it("formats percentages, areas, years and multiples as given", () => {
    expect(formatFigure(fig(2.525519158891164, "%"))).toBe("2.53%");
    expect(formatFigure(fig(5, "% per year"))).toBe("5% per year");
    expect(formatFigure(fig(103.06, "% occupancy"))).toBe("103.06% occupancy");
    expect(formatFigure(fig(14323, "sqm"))).toBe("14,323 sqm");
    expect(formatFigure(fig(10, "years"))).toBe("10 years");
    expect(formatFigure(fig(0.68, "x"))).toBe("0.68×");
  });
  it("formats ranges, scales and missing figures", () => {
    expect(formatRange(30000, 50000, "PHP/sqm")).toBe("₱30,000–₱50,000/sqm");
    expect(formatFigure({ ...fig(null, "sqm"), range: { low: 14000, high: 15000 } })).toBe("14,000–15,000 sqm");
    expect(formatFigure(fig(601.6, "PHP", { scale: "million" }))).toBe("₱601.6 million");
    expect(formatFigure(fig(null, "PHP"))).toBe("Inputs required");
  });
  it("Quick Report metric percentages are fractions (prototype convention)", () => {
    expect(formatMetric(-0.05, "%")).toBe("−5%");
    expect(formatMetric(0.16, "%")).toBe("16%");
    expect(formatMetric(null, "%")).toBe("—");
  });
  it("uses a true minus sign", () => {
    expect(num(-1.18)).toBe("−1.18");
  });
});
