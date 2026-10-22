/** Brand tokens mirrored from app/globals.css for the design board and contrast tests. */
export const palette = {
  navy: "#0e192f",
  panel: "#1c335e",
  bronze: "#be8562",
  "bronze-ink": "#8e5b3b",
  gold: "#e2b985",
  cream: "#fbf8f3",
  sand: "#f4f1ec",
  muted: "#5b6472",
  line: "#e3ddd3",
  ok: "#2a744a",
  warn: "#94590a",
  bad: "#b23a3a",
  info: "#1c5fa8",
  na: "#5f6b78",
  "ok-soft": "#e2f2e8",
  "warn-soft": "#fbefd9",
  "bad-soft": "#f8e3e3",
  "info-soft": "#e3eefa",
  "na-soft": "#eceff2",
  "bronze-soft": "#f6ece4",
  white: "#ffffff",
} as const;

/** Text/background pairs used in the UI. Each must reach 4.5:1 (normal text, WCAG 2.2 AA). */
export const usedPairs: [fg: keyof typeof palette, bg: keyof typeof palette, use: string][] = [
  ["navy", "cream", "Body text"],
  ["muted", "cream", "Secondary text"],
  ["muted", "white", "Secondary text on cards"],
  ["bronze-ink", "cream", "Links and eyebrows"],
  ["bronze-ink", "white", "Links on cards"],
  ["navy", "bronze", "Primary button"],
  ["navy", "gold", "Primary button hover"],
  ["white", "navy", "Dark sections"],
  ["gold", "navy", "Accent text on navy"],
  ["white", "panel", "Panel text"],
  ["ok", "white", "Success text"],
  ["warn", "white", "Warning text"],
  ["bad", "white", "Error text"],
  ["info", "white", "Info text"],
  ["ok", "ok-soft", "Success badge and banner"],
  ["warn", "warn-soft", "Warning badge, callout and notice"],
  ["bad", "bad-soft", "Error badge and alert"],
  ["info", "info-soft", "Info badge and banner"],
  ["na", "na-soft", "Neutral badge"],
  ["bronze-ink", "bronze-soft", "Brand badge"],
  ["muted", "sand", "Table headers"],
];

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}
