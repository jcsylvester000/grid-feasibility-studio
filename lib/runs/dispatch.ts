/**
 * Hands a queued run to the worker (BRD 7.3 step 2, plan section 4.2).
 *  - inline (your computer): runs in this Node process, after the response is sent (no time limit).
 *  - netlify: calls the Background Function run-worker (up to 15 minutes), which answers 202 at once.
 *    The browser then polls GET /api/runs/{id} every few seconds; each poll is a short request, so no
 *    request ever waits for VectorShift. Ordinary Netlify functions stop after about 26-30 seconds, so a
 *    run must never be executed inline there: on Netlify the mode defaults to "netlify" (GFS-28).
 */
import { appOrigin } from "./config";
import { dispatchSecret } from "./dispatch-secret";

/** Why a hand-off to the background function failed (shown as a reference code and logged). */
export class DispatchError extends Error {
  constructor(public readonly code: "DISPATCH_NOT_CONFIGURED" | "DISPATCH_UNREACHABLE" | `DISPATCH_HTTP_${number}`, detail: string) {
    super(`${code}: ${detail}`);
  }
}

type Schedule = (task: () => Promise<unknown>) => void;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True inside Netlify's functions runtime (or a Netlify build). */
export const onNetlify = () => process.env.NETLIFY === "true" || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

/** RUN_DISPATCH when set; otherwise "netlify" on Netlify and "inline" elsewhere. */
export function dispatchMode(): "inline" | "netlify" | "none" {
  const v = process.env.RUN_DISPATCH;
  if (v === "inline" || v === "netlify" || v === "none") return v;
  return onNetlify() ? "netlify" : "inline";
}

/**
 * Site address for calling the background function: the address the request came in on, then Netlify's
 * own site URL, then APP_ORIGIN. (A wrong APP_ORIGIN must not stop runs from starting.)
 */
function workerOrigins(origin?: string) {
  const list = [origin, process.env.URL, process.env.DEPLOY_PRIME_URL, appOrigin()].filter((o): o is string => !!o).map((o) => o.replace(/\/$/, ""));
  return [...new Set(list)];
}

export async function dispatchRun(runId: string, opts: { delayMs?: number; schedule?: Schedule; origin?: string } = {}) {
  const delayMs = opts.delayMs ?? 0;
  const mode = dispatchMode();
  if (mode === "none") return; // tests: the caller runs executeRun itself
  if (mode === "netlify") {
    const secret = dispatchSecret();
    if (!secret) throw new DispatchError("DISPATCH_NOT_CONFIGURED", "neither INTERNAL_DISPATCH_SECRET nor APP_SECRET is set");
    // The address the request came in on first; then Netlify's own site addresses; then APP_ORIGIN.
    let last: DispatchError | null = null;
    for (const origin of workerOrigins(opts.origin)) {
      try {
        const res = await fetch(`${origin}/.netlify/functions/run-worker`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-internal-secret": secret },
          body: JSON.stringify({ runId, delayMs }),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.status === 202 || res.ok) return;
        last = new DispatchError(`DISPATCH_HTTP_${res.status}`, `${origin} answered ${res.status}`);
      } catch (err) {
        last = new DispatchError("DISPATCH_UNREACHABLE", `${origin}: ${err instanceof Error ? err.message : String(err)}`);
      }
      console.error(JSON.stringify({ evt: "dispatch.failed", runId, error: last.message }));
    }
    throw last ?? new DispatchError("DISPATCH_UNREACHABLE", "no address to call");
  }
  const task = async () => {
    if (delayMs) await sleep(delayMs);
    const { executeRun } = await import("./worker");
    await executeRun(runId);
  };
  if (opts.schedule) opts.schedule(task);
  else void task().catch((err) => console.error("inline run failed:", err));
}
