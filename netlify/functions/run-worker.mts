/**
 * Netlify Background Function: runs one VectorShift pipeline call for a queued run (up to 15 minutes;
 * the caller gets 202 immediately). Called by lib/runs/dispatch.ts when RUN_DISPATCH=netlify with
 * header x-internal-secret = INTERNAL_DISPATCH_SECRET and body { runId, delayMs }.
 * Same worker module as local runs (lib/runs/worker.ts), so behaviour is identical.
 */
import type { Config } from "@netlify/functions";
import { executeRun } from "../../lib/runs/worker";

export default async (req: Request) => {
  const secret = process.env.INTERNAL_DISPATCH_SECRET;
  if (!secret || req.headers.get("x-internal-secret") !== secret) {
    console.warn("run-worker: refused (bad or missing internal secret)");
    return;
  }
  const { runId, delayMs } = (await req.json().catch(() => ({}))) as { runId?: string; delayMs?: number };
  if (!runId) return;
  if (delayMs && delayMs > 0) await new Promise((r) => setTimeout(r, Math.min(delayMs, 60_000)));
  const result = await executeRun(runId);
  console.log(`run-worker: ${runId} ${JSON.stringify(result)}`);
};

export const config: Config = { background: true };
