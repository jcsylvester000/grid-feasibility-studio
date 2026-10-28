/** Feature flags. Read at build time for static pages and at request time elsewhere. */
export const isTeaserScanEnabled = () => process.env.FEATURE_TEASER_SCAN === "true";

const KEY = { quick_report: "QUICK_REPORT", executive_summary: "EXECUTIVE_SUMMARY", feasibility_report: "FEASIBILITY_REPORT", teaser_intake: "TEASER_INTAKE" } as const;
type P = keyof typeof KEY;

/**
 * A product is live when its pipeline is configured on VectorShift's own API: VS_BASE_URL_<PRODUCT> or
 * VECTORSHIFT_BASE_URL is https://api.vectorshift.ai and VS_PIPELINE_<PRODUCT> is a real pipeline id
 * (not a mock-… id). Anything else runs on the stand-in pipeline.
 */
export function isLiveProduct(product: P) {
  const base = process.env[`VS_BASE_URL_${KEY[product]}`] || process.env.VECTORSHIFT_BASE_URL || "";
  const id = process.env[`VS_PIPELINE_${KEY[product]}`] || "";
  return /^https:\/\/api\.vectorshift\.ai/.test(base) && !!id && !/^(mock-|demo-)/.test(id);
}

/** The enabled products split into live and stand-in. */
export function pipelineStatus() {
  const products: P[] = ["quick_report", "executive_summary", "feasibility_report", ...(isTeaserScanEnabled() ? (["teaser_intake"] as P[]) : [])];
  return { live: products.filter(isLiveProduct), standIn: products.filter((p) => !isLiveProduct(p)) };
}

/**
 * Prototype mode: at least one product still runs on the stand-in pipeline (or PROTOTYPE_MODE=true).
 * The banner then says which products are live.
 */
export const isPrototypeMode = () => process.env.PROTOTYPE_MODE === "true" || pipelineStatus().standIn.length > 0;

/** Runs produced by the mock or demo stand-in pipelines (not live VectorShift). */
export const isStandInPipeline = (pipelineId: string | null | undefined) => !!pipelineId && /^(mock-|demo-)/.test(pipelineId);
