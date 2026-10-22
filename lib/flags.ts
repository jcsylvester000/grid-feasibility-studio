/** Feature flags. Read at build time for static pages and at request time elsewhere. */
export const isTeaserScanEnabled = () => process.env.FEATURE_TEASER_SCAN === "true";

/**
 * Prototype mode: reports come from the mock / stand-in pipeline, not the live VectorShift pipelines.
 * On whenever VECTORSHIFT_BASE_URL is not VectorShift's API, or when PROTOTYPE_MODE=true.
 */
export const isPrototypeMode = () =>
  process.env.PROTOTYPE_MODE === "true" || !/^https:\/\/api\.vectorshift\.ai/.test(process.env.VECTORSHIFT_BASE_URL ?? "");

/** Runs produced by the mock or demo stand-in pipelines (not live VectorShift). */
export const isStandInPipeline = (pipelineId: string | null | undefined) => !!pipelineId && /^(mock-|demo-)/.test(pipelineId);
