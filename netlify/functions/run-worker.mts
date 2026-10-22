/**
 * Netlify Background Function: runs one VectorShift pipeline call for a queued run
 * (up to 15 minutes; the caller gets 202 immediately). Called by lib/runs/dispatch.ts when
 * RUN_DISPATCH=netlify, with header x-internal-secret = INTERNAL_DISPATCH_SECRET and body { runId }.
 * The worker logic itself is added in batch B4 (lib/runs/worker.ts).
 */
import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  const secret = process.env.INTERNAL_DISPATCH_SECRET;
  if (!secret || req.headers.get("x-internal-secret") !== secret) {
    console.warn("run-worker: refused (bad or missing internal secret)");
    return;
  }
  const { runId } = (await req.json().catch(() => ({}))) as { runId?: string };
  console.log(`run-worker: received run ${runId ?? "(none)"}; worker arrives in batch B4`);
};

export const config: Config = { background: true };
