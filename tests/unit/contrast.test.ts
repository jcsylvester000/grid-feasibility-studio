import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, palette, usedPairs } from "@/lib/design/tokens";

describe("brand colour contrast (WCAG 2.2 AA)", () => {
  for (const [fg, bg, use] of usedPairs) {
    it(`${use}: ${fg} on ${bg} is at least 4.5:1`, () => {
      expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("white on bronze fails, so it is never used for text", () => {
    expect(contrast(palette.white, palette.bronze)).toBeLessThan(4.5);
  });
  it("tokens match app/globals.css", () => {
    const css = readFileSync("app/globals.css", "utf8");
    for (const [name, hex] of Object.entries(palette)) {
      if (name === "white") continue;
      expect(css, name).toContain(`--color-${name}: ${hex};`);
    }
  });
});
