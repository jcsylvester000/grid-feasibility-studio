/**
 * Shared secret between the app and the run-worker background function. INTERNAL_DISPATCH_SECRET when set;
 * otherwise derived from APP_SECRET (which every deployment already has), so a missing setting cannot stop
 * runs from starting (GFS-30). No app imports: this module is bundled into the Netlify function.
 */
import { createHmac } from "node:crypto";

export function dispatchSecret(): string | null {
  const explicit = process.env.INTERNAL_DISPATCH_SECRET;
  if (explicit) return explicit;
  const app = process.env.APP_SECRET;
  if (!app) return null;
  return createHmac("sha256", app).update("grid-feasibility-studio:run-worker:v1").digest("base64url");
}
