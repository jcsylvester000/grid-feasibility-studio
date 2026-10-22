import { describe, expect, it } from "vitest";
import { feasibilityStudy, home, howItWorks, products } from "@/content/site";
import { formatDate, formatPHP } from "@/lib/format";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("public copy", () => {
  it("AC-004: each of the five feasibility blocks has 60 words or fewer", () => {
    expect(feasibilityStudy.blocks).toHaveLength(5);
    for (const b of feasibilityStudy.blocks) expect(words(b.body), b.title).toBeLessThanOrEqual(60);
  });
  it("How it works has four steps and five FAQ answers (P-03)", () => {
    expect(howItWorks.steps).toHaveLength(4);
    expect(howItWorks.faq).toHaveLength(5);
  });
  it("Home has three 'why' points and four products, one behind the Teaser flag (P-01)", () => {
    expect(home.why).toHaveLength(3);
    expect(products).toHaveLength(4);
    expect(products.filter((p) => p.flag === "teaser").map((p) => p.key)).toEqual(["teaser_intake"]);
  });
});

describe("formatting (BRD 8.1 rule 5)", () => {
  it("formats pesos with separators", () => {
    expect(formatPHP(601566000)).toBe("₱601,566,000");
  });
  it("formats dates as 22 Oct 2026", () => {
    expect(formatDate("2026-10-22")).toBe("22 Oct 2026");
    expect(formatDate(new Date("2026-10-21T18:30:00Z"))).toBe("22 Oct 2026"); // Manila time
  });
});
