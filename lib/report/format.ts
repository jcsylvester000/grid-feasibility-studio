/**
 * Number and label formatting for the report viewer (BRD 8.1 rule 5): numbers are shown exactly as the
 * payload gives them, with formatting only (PHP currency, thousands separators, dates "22 Oct 2026").
 * Peso amounts of ₱1,000 or more are shown to the whole peso; smaller amounts to the centavo.
 */
import { formatDate } from "@/lib/format";

export type Figure = {
  value: number | null;
  range: { low: number; high: number } | null;
  unit: string;
  scale?: "one" | "thousand" | "million" | "billion";
  basis?: string;
  as_of: string | null;
  status: string;
  source_ids: string[];
  note?: string;
};

const MINUS = "−";

/** 1234567.891 → "1,234,567.89"; trims trailing zeros; keeps the sign as a true minus. */
export function num(v: number, maxDecimals = 2) {
  const s = new Intl.NumberFormat("en-PH", { maximumFractionDigits: maxDecimals, minimumFractionDigits: 0 }).format(Math.abs(v));
  return v < 0 ? `${MINUS}${s}` : s;
}

export function peso(v: number) {
  const abs = Math.abs(v);
  const s = abs >= 1000 ? num(abs, 0) : num(abs, 2);
  return v < 0 ? `${MINUS}₱${s}` : `₱${s}`;
}

const SCALE_WORD = { one: "", thousand: " thousand", million: " million", billion: " billion" } as const;

/** Formats one value in a unit, e.g. (42000, "PHP/sqm") → "₱42,000/sqm". */
export function formatValue(v: number, unit: string, scale: Figure["scale"] = "one") {
  const sw = SCALE_WORD[scale ?? "one"];
  const u = unit.trim();
  if (u === "PHP") return `${peso(v)}${sw}`;
  if (u.startsWith("PHP/")) return `${peso(v)}${sw}/${u.slice(4)}`;
  if (u.startsWith("PHP ")) return `${peso(v)}${sw} ${u.slice(4)}`;
  if (u === "%") return `${num(v)}%`;
  if (u.startsWith("% ")) return `${num(v)}% ${u.slice(2)}`;
  if (u === "x") return `${num(v)}×`;
  if (!u) return `${num(v)}${sw}`;
  return `${num(v)}${sw} ${u}`;
}

export function formatRange(low: number, high: number, unit: string, scale: Figure["scale"] = "one") {
  const a = formatValue(low, unit, scale);
  const b = formatValue(high, unit, scale);
  // "₱30,000/sqm–₱50,000/sqm" reads badly; share the unit suffix when both sides end the same way.
  const suffix = unit.startsWith("PHP/") ? `/${unit.slice(4)}` : unit && !unit.startsWith("PHP") && unit !== "%" && unit !== "x" ? ` ${unit}` : "";
  if (suffix && a.endsWith(suffix) && b.endsWith(suffix)) return `${a.slice(0, -suffix.length)}–${b}`;
  return `${a}–${b}`;
}

/** A Figure as text; both value and range null means the input is still required. */
export function formatFigure(f: Figure) {
  if (f.value !== null && f.value !== undefined) return formatValue(f.value, f.unit, f.scale);
  if (f.range) return formatRange(f.range.low, f.range.high, f.unit, f.scale);
  return "Inputs required";
}

/**
 * Quick Report metrics: "%" values are fractions (−0.05 = −5%), as in the prototype renderer
 * (quick.js fmtVal). Figures elsewhere carry whole percentages (IRR 2.53 = 2.53%). Ledger GFS-19.
 */
export function formatMetric(v: number | null, unit: string) {
  if (v === null || v === undefined) return "—";
  if (unit === "%") return `${num(v * 100, 1)}%`;
  return formatValue(v, unit);
}

export const STATUS_LABELS: Record<string, string> = {
  verified_document: "Verified",
  checked_public_source: "Public source",
  to_be_confirmed: "To be confirmed",
  owner_input: "Owner input",
  computed: "Computed",
  estimate: "Estimate",
  assumption: "Assumption",
};

export const STATUS_TONES: Record<string, "ok" | "info" | "warn" | "neutral" | "brand"> = {
  verified_document: "ok",
  checked_public_source: "info",
  to_be_confirmed: "warn",
  owner_input: "neutral",
  computed: "neutral",
  estimate: "brand",
  assumption: "brand",
};

export const BASIS_LABELS: Record<string, string> = {
  asking: "asking price",
  closed: "closed sale",
  zonal: "BIR zonal value",
  appraised: "appraised",
  assessed: "assessed value",
};

export const COVERAGE_LABELS: Record<string, string> = {
  complete: "Complete",
  partial: "Partial",
  light: "Light",
  inputs_required: "Inputs required",
  out_of_scope: "Out of scope",
};

export const asOf = (d: string | null | undefined) => (d ? formatDate(d.slice(0, 10)) : null);
