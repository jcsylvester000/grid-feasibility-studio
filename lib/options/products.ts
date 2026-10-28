/**
 * Product catalogue for the signed-in app. Typical-time estimates are the Project Brief v1.1 targets
 * (19 Oct 2026): Executive Summary under 30 minutes, Feasibility Report under 3 hours. Quick Report: about
 * 1 minute on the live VectorShift pipeline (28 Oct 2026: GRID reports under 30 s; first measured run 102 s). They are shown as "estimate" until 20 successful runs exist (BRD S-01, AC-021).
 * GRID-DECISION: Teaser Scan has no published target; 5 minutes is a placeholder.
 */
import type { Product } from "@/lib/db/schema";

export type ProductInfo = {
  key: Product;
  name: string;
  short: string;
  answers: string;
  needs: string;
  estimateMs: number;
  flag?: "teaser";
};

const MIN = 60_000;

export const PRODUCTS: ProductInfo[] = [
  {
    key: "quick_report",
    name: "Quick Report",
    short: "Fast price screen against comparable listings.",
    answers: "Is the asking price below, inside or above comparable listings?",
    needs: "Dropdowns only: location, lot area, asking price and comparables",
    estimateMs: 1 * MIN,
  },
  {
    key: "executive_summary",
    name: "Executive Summary",
    short: "One sourced page for a client or a decision.",
    answers: "What are the market, site, risks and key figures, on one page?",
    needs: "A few facts and any documents you have",
    estimateMs: 30 * MIN,
  },
  {
    key: "feasibility_report",
    name: "Feasibility Report",
    short: "The full study with financials and a verdict.",
    answers: "Can this project work: market, site, legal, financial, risks?",
    needs: "The full set of inputs, including costs and funding, plus documents",
    estimateMs: 3 * 60 * MIN,
  },
  {
    key: "teaser_intake",
    name: "Teaser Scan",
    short: "Start from a teaser, fact sheet or post.",
    answers: "What does this teaser really say, and do its claims hold up?",
    needs: "A teaser file, screenshot or pasted post",
    estimateMs: 5 * MIN,
    flag: "teaser",
  },
];

export const productInfo = (p: Product) => PRODUCTS.find((x) => x.key === p)!;

export const isProductEnabled = (p: ProductInfo, teaserOn: boolean) => p.flag !== "teaser" || teaserOn;
