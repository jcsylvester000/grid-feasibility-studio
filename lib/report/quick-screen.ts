/**
 * Quick Report price screen computed by code from the answers entered (GRID principle: money arithmetic
 * is never done by a language model). The live pipeline supplies research (market snapshot, sources,
 * checks, summary); the rating and key figures shown come from here, so they always follow the rule:
 *   below the comparable low = Promising; inside the range = Marginal; above the high = Weak.
 * GRID placeholder bands; the team must confirm before launch.
 */
import { num, peso } from "./format";

export type ScreenRating = "promising" | "marginal" | "weak" | "cannot_tell";
export type ScreenFigure = { key: string; label: string; value: string; formula: string };
export type ScreenCheck = { key: string; tone: "warning" | "info"; detail: string };
export type QuickScreen = {
  rating: ScreenRating;
  label: string;
  headline: string;
  figures: ScreenFigure[];
  checks: ScreenCheck[];
  price: { base: number; unit: string; compare: { low: number; high: number } } | null;
};

export const SCREEN_LABEL: Record<ScreenRating, string> = {
  promising: "Promising — worth a full study",
  marginal: "Marginal — fairly priced",
  weak: "Weak — priced above the market",
  cannot_tell: "Can't tell yet",
};
export const SCREEN_RULE =
  "Indicative price screen, not a feasibility verdict. Below the comparable low = Promising; inside the range = Marginal; above the comparable high = Weak. GRID placeholder bands; the team must confirm before launch.";

const n = (v: unknown) => {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};
const pct = (v: number) => `${v > 0 ? "+" : ""}${num(v * 100, 1)}%`;
const psqm = (v: number) => `${peso(v)}/sqm`;

export function quickScreen(intake: Record<string, unknown>): QuickScreen {
  const ask = n(intake["qd.ask_psqm"]);
  const low = n(intake["qd.comp_low"]);
  const high = n(intake["qd.comp_high"]);
  const area = n(intake["qd.lot_area"]);
  const zonal = n(intake["qd.zonal"]);
  const commission = n(intake["qd.commission"]);
  const building = n(intake["qd.floor_area"]);
  const rent = n(intake["qd.rent"]);
  const compCount = n(intake["qd.comp_count"]);
  const asOf = n(intake["qd.as_of"]);

  const ok = ask !== null && ask > 0 && low !== null && low > 0 && high !== null && high >= low;
  let rating: ScreenRating = "cannot_tell";
  let headline = "Not enough to screen yet: add the asking price and the comparable range.";
  if (ok) {
    const mid = (low + high) / 2;
    if (ask < low) {
      rating = "promising";
      headline = `Promising: asked at ${psqm(ask)}, ${num(((low - ask) / low) * 100, 0)}% below the lowest comparable (${psqm(low)}). Worth a closer look before others notice.`;
    } else if (ask > high) {
      rating = "weak";
      headline = `Weak: asked at ${psqm(ask)}, ${num(((ask - high) / high) * 100, 0)}% above the highest comparable (${psqm(high)}). Overpriced unless something sets this property apart.`;
    } else {
      rating = "marginal";
      const half = ask <= mid ? "lower" : "upper";
      const vsMid = ((ask - mid) / mid) * 100;
      headline = `Marginal: asked at ${psqm(ask)}, inside the comparable range of ${psqm(low)} to ${psqm(high)}, in the ${half} half (${num(Math.abs(vsMid), 0)}% ${vsMid <= 0 ? "under" : "over"} the middle). Fair pricing; the upside has to come from negotiation or the use.`;
    }
    if (compCount !== null && compCount <= 2) headline += " Few comparables, so treat this as a first look.";
  }

  const figures: ScreenFigure[] = [];
  if (ask !== null) figures.push({ key: "ask_psqm", label: "Asking price per sqm", value: psqm(ask), formula: "As entered" });
  const total = ask !== null && area ? ask * area : null;
  if (total !== null) figures.push({ key: "total", label: "Total asking price", value: peso(total), formula: `${psqm(ask!)} × about ${num(area!, 0)} sqm (lot area band, approximate)` });
  if (ok && area) {
    figures.push({ key: "value_low", label: "Value at the lowest comparable", value: peso(low * area), formula: `${psqm(low)} × lot area` });
    figures.push({ key: "value_high", label: "Value at the highest comparable", value: peso(high * area), formula: `${psqm(high)} × lot area` });
  }
  if (ok) {
    const mid = (low + high) / 2;
    figures.push({ key: "vs_low", label: "Asking price against the lowest comparable", value: pct((ask - low) / low), formula: "(asking − lowest) ÷ lowest" });
    figures.push({ key: "vs_high", label: "Asking price against the highest comparable", value: pct((ask - high) / high), formula: "(asking − highest) ÷ highest" });
    figures.push({ key: "vs_mid", label: "Asking price against the middle of the range", value: pct((ask - mid) / mid), formula: `(asking − middle) ÷ middle; middle ${psqm(mid)}` });
  }
  if (ask !== null && zonal) {
    figures.push({ key: "vs_zonal", label: "Asking price ÷ BIR zonal value", value: `${num(ask / zonal, 2)}×`, formula: `${psqm(ask)} ÷ ${psqm(zonal)} (zonal value is a tax basis, not market value)` });
    if (area) figures.push({ key: "zonal_total", label: "BIR zonal value, whole lot", value: peso(zonal * area), formula: `${psqm(zonal)} × lot area` });
  }
  if (total !== null && commission) {
    figures.push({ key: "commission", label: `Commission at ${num(commission, 1)}%`, value: peso((total * commission) / 100), formula: "Total asking price × commission" });
    figures.push({ key: "proceeds", label: "Seller's proceeds after commission", value: peso(total * (1 - commission / 100)), formula: "Before capital gains tax, transfer costs and other closing costs" });
  }
  if (building && rent) {
    const monthly = building * rent;
    figures.push({ key: "rent_month", label: "Gross rent per month", value: peso(monthly), formula: `${peso(rent)}/sqm/month × about ${num(building, 0)} sqm of building` });
    figures.push({ key: "rent_year", label: "Gross rent per year", value: peso(monthly * 12), formula: "Monthly rent × 12, before vacancy and costs" });
    if (total) figures.push({ key: "gross_yield", label: "Gross yield on the asking price", value: `${num(((monthly * 12) / total) * 100, 1)}%`, formula: "Yearly rent ÷ total asking price" });
  }

  const checks: ScreenCheck[] = [];
  if (intake["qd.title_copy"] !== "yes") checks.push({ key: "app_no_title", tone: "warning", detail: "No title (TCT/CCT) copy yet. Get a photocopy from the seller, then a certified true copy from the Registry of Deeds." });
  if (intake["qd.tax_dec"] !== "yes") checks.push({ key: "app_no_tax_dec", tone: "warning", detail: "No tax declaration copy yet. Ask the seller or the assessor's office." });
  if (!zonal) checks.push({ key: "app_zonal", tone: "warning", detail: "BIR zonal value not checked yet. It is public and quick to look up." });
  else if (ask !== null && ask < zonal) checks.push({ key: "app_below_zonal", tone: "warning", detail: `The asking price is below the BIR zonal value (${num(ask / zonal, 2)}×). Taxes on a sale are based on the higher of the two; check why the price is low.` });
  if (compCount !== null && compCount <= 2) checks.push({ key: "app_few_comps", tone: "info", detail: compCount === 0 ? "No comparable listings yet." : "Only 1–2 comparable listings: a thin basis for the rating." });
  if (asOf !== null && asOf >= 5) checks.push({ key: "app_stale_comps", tone: "info", detail: "The comparables are more than 3 months old; prices may have moved." });
  checks.push({ key: "app_asking", tone: "info", detail: "Comparables are asking prices from listings, not closed sales." });

  return { rating, label: SCREEN_LABEL[rating], headline, figures, checks, price: ok ? { base: ask, unit: "PHP/sqm", compare: { low, high } } : null };
}
