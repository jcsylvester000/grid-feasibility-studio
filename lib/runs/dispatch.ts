/**
 * Hands a queued run to the worker (BRD 7.3 step 2, plan section 4.2).
 *  - inline (your computer): runs in this Node process, after the response is sent (no time limit).
 *  - netlify: calls the Background Function run-worker (up to 15 minutes), which answers 202 at once.
 */
import { appOrigin } from "./config";

type Schedule = (task: () => Promise<unknown>) => void;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function dispatchRun(runId: string, opts: { delayMs?: number; schedule?: Schedule } = {}) {
  const delayMs = opts.delayMs ?? 0;
  if (process.env.RUN_DISPATCH === "none") return; // tests: the caller runs executeRun itself
  if (process.env.RUN_DISPATCH === "netlify") {
    const secret = process.env.INTERNAL_DISPATCH_SECRET;
    if (!secret) throw new Error("Missing environment variable INTERNAL_DISPATCH_SECRET");
    const res = await fetch(`${appOrigin()}/.netlify/functions/run-worker`, {
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
