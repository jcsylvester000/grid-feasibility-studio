import { after } from "next/server";
import { apiSession, json, jsonError } from "@/lib/http";
import { DispatchError, dispatchRun } from "@/lib/runs/dispatch";
import { failQueuedRun } from "@/lib/db/repos/runs";
import { startRun } from "@/lib/runs/service";

/** Keeps the inline worker alive after the response (local); Netlify uses the Background Function. */
export const maxDuration = 60;

/** POST /api/reports/{id}/runs: start a run. 202 { runId }; 409 when one is in progress; 429 RATE_LIMITED. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const result = await startRun(a.session.user, (await params).id);
  if (!result.ok)
    return json({ error: { code: result.code, message: result.message, issues: result.issues } }, { status: result.status });
  try {
    await dispatchRun(result.runId, { schedule: (task) => after(task), origin: new URL(req.url).origin });
  } catch (err) {
    console.error("dispatch failed:", err instanceof Error ? err.message : err);
    await failQueuedRun(result.runId, "VS_UNAVAILABLE").catch(() => null);
    const ref = err instanceof DispatchError ? err.code : "DISPATCH_FAILED";
    return jsonError(503, ref, `The report could not be started. Try again. If it keeps happening, tell GRID support the reference ${ref}.`);
  }
  return json({ runId: result.runId }, { status: 202 });
}
