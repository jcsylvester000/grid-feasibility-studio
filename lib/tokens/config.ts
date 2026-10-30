/**
 * GRID Tokens (prototype wallet, 30 Oct 2026). Each account starts with TOKENS_STARTING_BALANCE (100).
 * Running a report uses its product's cost; a product with no cost here is not charged yet.
 * Shown to users as "GRID Tokens" only: no money value is displayed anywhere in the app.
 * FEATURE_TOKENS=false switches the wallet off (no charges, no prompts).
 */
import type { Product } from "@/lib/db/schema";

export const tokensEnabled = () => process.env.FEATURE_TOKENS !== "false";

export const startingBalance = () => {
  const v = Number(process.env.TOKENS_STARTING_BALANCE);
  return Number.isInteger(v) && v >= 0 ? v : 100;
};

/** Tokens per run (GRID pricing, 30 Oct 2026: VectorShift run cost plus the platform markup).
 *  TOKENS_COST_<PRODUCT> overrides a price without a code change. */
export const DEFAULT_TOKEN_COSTS: Partial<Record<Product, number>> = { quick_report: 30, executive_summary: 50, feasibility_report: 100 };
const COST_PRODUCTS: Product[] = ["quick_report", "executive_summary", "feasibility_report", "teaser_intake"];

/** Tokens per run for each product: TOKENS_COST_QUICK_REPORT, TOKENS_COST_EXECUTIVE_SUMMARY, ... override the defaults. */
export function tokenCosts(): Partial<Record<Product, number>> {
  const out: Partial<Record<Product, number>> = {};
  for (const p of COST_PRODUCTS) {
    const raw = process.env[`TOKENS_COST_${p.toUpperCase()}`];
    const v = raw === undefined || raw === "" ? DEFAULT_TOKEN_COSTS[p] : Number(raw);
    if (typeof v === "number" && Number.isInteger(v) && v > 0) out[p] = v;
  }
  return out;
}

export const tokenCost = (product: Product | string) => (tokensEnabled() ? (tokenCosts()[product as Product] ?? 0) : 0);

/** Balance at or below which the wallet is shown as low. */
export const LOW_BALANCE = 100;

/** Demo top-up amount (demo mode only) and the most a wallet may hold. */
export const DEMO_TOP_UP = 300;
export const MAX_BALANCE = 1000;

export const tokenWord = (n: number) => (n === 1 ? "GRID Token" : "GRID Tokens");
