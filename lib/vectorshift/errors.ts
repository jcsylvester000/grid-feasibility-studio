/**
 * App error codes for runs (BRD 7.5) and envelope error codes (BRD v1.1 6.6), with the plain message
 * the run status page shows and the retry policy.
 */
import type { Product } from "@/lib/db/schema";

export const APP_CODES = [
  "VS_AUTH",
  "VS_BAD_REQUEST",
  "VS_FAILED",
  "VS_UNAVAILABLE",
  "VS_TIMEOUT",
  "VS_OUTPUT_MISSING",
  "SCHEMA_INVALID",
  "FILE_FETCH_FAILED",
  "RATE_LIMITED",
] as const;
export type AppCode = (typeof APP_CODES)[number];

export type Retry = "auto" | "manual" | "none";

const MESSAGES: Record<string, { message: string; retry: Retry }> = {
  VS_AUTH: { message: "The report service is unavailable right now. GRID has been notified.", retry: "none" },
  VS_BAD_REQUEST: { message: "Something went wrong. GRID has been notified.", retry: "none" },
  VS_FAILED: { message: "The report could not be generated.", retry: "manual" },
  VS_UNAVAILABLE: { message: "The report service did not respond.", retry: "auto" },
  VS_TIMEOUT: { message: "This is taking longer than usual.", retry: "auto" },
  VS_OUTPUT_MISSING: { message: "Something went wrong. GRID has been notified.", retry: "none" },
  SCHEMA_INVALID: { message: "The report could not be generated.", retry: "manual" },
  FILE_FETCH_FAILED: { message: "One of your files could not be read. Upload it again.", retry: "manual" },
  RATE_LIMITED: { message: "Please wait for your other report to finish.", retry: "manual" },
  // Envelope error codes (inside a failed envelope).
  INPUT_INVALID: { message: "Some inputs were not accepted. Check the form and try again.", retry: "manual" },
  INPUT_INSUFFICIENT: { message: "There is not enough information to produce this report. Add more inputs and try again.", retry: "manual" },
  DOCUMENT_UNREADABLE: { message: "One of your documents could not be read. Upload a clearer copy.", retry: "manual" },
  NODE_FAILED: { message: "The report could not be generated.", retry: "manual" },
  NODE_TIMEOUT: { message: "This is taking longer than usual.", retry: "manual" },
  PROVIDER_UNAVAILABLE: { message: "A research service was unavailable.", retry: "manual" },
  RUN_CANCELLED: { message: "Cancelled.", retry: "manual" },
  QA_BLOCKER: { message: "The report did not pass GRID's quality checks.", retry: "manual" },
  LOW_EVIDENCE: { message: "There was not enough public evidence to produce this report.", retry: "manual" },
  INTERNAL: { message: "Something went wrong. GRID has been notified.", retry: "manual" },
};

export function describeError(code: string | null | undefined) {
  return MESSAGES[code ?? ""] ?? MESSAGES.INTERNAL!;
}

/** 7.3 step 6: VS_UNAVAILABLE retried once; VS_TIMEOUT retried once for the short products only. */
export function shouldAutoRetry(code: string, product: Product, attempt: number) {
  if (attempt > 1) return false;
  if (code === "VS_UNAVAILABLE") return true;
  if (code === "VS_TIMEOUT") return product === "quick_report" || product === "teaser_intake";
  return false;
}

/** Codes after which the user may press Retry. */
export const canRetry = (code: string | null | undefined) => describeError(code).retry !== "none";
