/**
 * Hands a queued run to the worker (BRD 7.3 step 2, plan section 4.2).
 *  - inline (your computer): runs in this Node process, after the response is sent (no time limit).
 *  - netlify: calls the Background Function run-worker (up to 15 minutes), which answers 202 at once.
 *    The browser then polls GET /api/runs/{id} every few seconds; each poll is a short request, so no
 *    request ever waits for VectorShift. Ordinary Netlify functions stop after about 26-30 seconds, so a
 *    run must never be executed inline there: on Netlify the mode defaults to "netlify" (GFS-28).
 */
import { appOrigin } from "./config";

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
function workerOrigin(origin?: string) {
  return (origin || process.env.URL || appOrigin()).replace(/\/$/, "");
}

export async function dispatchRun(runId: string, opts: { delayMs?: number; schedule?: Schedule; origin?: string } = {}) {
  const delayMs = opts.delayMs ?? 0;
  const mode = dispatchMode();
  if (mode === "none") return; // tests: the caller runs executeRun itself
  if (mode === "netlify") {
    const secret = process.env.INTERNAL_DISPATCH_SECRET;
    if (!secret) throw new Error("Missing environment variable INTERNAL_DISPATCH_SECRET");
    const res = await fetch(`${workerOrigin(opts.origin)}/.netlify/functions/run-worker`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ runId, delayMs }),
    });
    if (res.status !== 202 && !res.ok) throw new Error(`run-worker dispatch failed with HTTP ${res.status}`);
    return;
  }
  const task = async () => {
    if (delayMs) await sleep(delayMs);
    const { executeRun } = await import("./worker");
    await executeRun(runId);
  };
  if (opts.schedule) opts.schedule(task);
  else void task().catch((err) => console.error("inline run failed:", err));
}
