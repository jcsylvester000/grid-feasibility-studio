/** Run settings from the environment (read directly; this module also runs inside the Netlify function). */
import type { Product } from "@/lib/db/schema";

/** Netlify Background Functions stop at 15 minutes; the call timeout stays 60 s below that (BRD 7.3 step 4). */
export const DEFAULT_TIMEOUT_MS = 14 * 60_000;
export const RETRY_DELAY_MS = 20_000;
export const STALE_GRACE_MS = 2 * 60_000;

const ENV_KEY: Record<Product, string> = {
  quick_report: "QUICK_REPORT",
  executive_summary: "EXECUTIVE_SUMMARY",
  feasibility_report: "FEASIBILITY_REPORT",
  teaser_intake: "TEASER_INTAKE",
};

export function pipelineId(product: Product) {
  return process.env[`VS_PIPELINE_${ENV_KEY[product]}`] || "";
}

export function timeoutMs(product: Product) {
  const v = Number(process.env[`VS_TIMEOUT_MS_${ENV_KEY[product]}`]);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TIMEOUT_MS;
}

export const maxConcurrent = () => Number(process.env.VS_MAX_CONCURRENT) || 10;
export const MAX_ACTIVE_PER_USER = 2;

export const VECTORSHIFT_API = "https://api.vectorshift.ai";

/**
 * Where a product's pipeline runs. VECTORSHIFT_BASE_URL for all products; VS_BASE_URL_<PRODUCT> overrides it
 * for one product (e.g. Quick Report on VectorShift while the others still use the local mock).
 */
export function baseUrlFor(product: Product) {
  return process.env[`VS_BASE_URL_${ENV_KEY[product]}`] || process.env.VECTORSHIFT_BASE_URL || VECTORSHIFT_API;
}

/** True when the product's pipeline is VectorShift's own API (not the mock or a stand-in). */
export const isLivePipeline = (product: Product) => /^https:\/\/api\.vectorshift\.ai/.test(baseUrlFor(product));

/**
 * How a product's inputs are sent. "fields": one text input per answer (the live Quick Report pipeline).
 * "run_request": one JSON run_request input (BRD v2.0 contract; the other products and the tests).
 * VS_INPUT_<PRODUCT> overrides; the Quick Report defaults to "fields".
 */
export function inputMode(product: Product): "fields" | "run_request" {
  const v = process.env[`VS_INPUT_${ENV_KEY[product]}`];
  if (v === "fields" || v === "run_request") return v;
  return product === "quick_report" ? "fields" : "run_request";
}

export function vectorShift(product?: Product) {
  const baseUrl = product ? baseUrlFor(product) : process.env.VECTORSHIFT_BASE_URL || VECTORSHIFT_API;
  const isLocalMock = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(baseUrl);
  // The local mock accepts any bearer key, so the real key is never sent to it.
  const apiKey = isLocalMock ? "local-mock-key" : process.env.VECTORSHIFT_API_KEY || "";
  return { baseUrl, apiKey };
}

export const appOrigin = () => process.env.APP_ORIGIN || "http://localhost:3000";
