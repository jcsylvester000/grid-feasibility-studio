/** Feature flags. Read at build time for static pages and at request time elsewhere. */
export const isTeaserScanEnabled = () => process.env.FEATURE_TEASER_SCAN === "true";
