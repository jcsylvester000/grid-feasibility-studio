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

export function vectorShift() {
  const baseUrl = process.env.VECTORSHIFT_BASE_URL || "https://api.vectorshift.ai";
  const isLocalMock = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(baseUrl);
  // The local mock accepts any bearer key; the real service needs VECTORSHIFT_API_KEY.
  const apiKey = process.env.VECTORSHIFT_API_KEY || (isLocalMock ? "local-mock-key" : "");
  return { baseUrl, apiKey };
}

export const appOrigin = () => process.env.APP_ORIGIN || "http://localhost:3000";
