import { apiSession, json, jsonError } from "@/lib/http";
import { cancelRun } from "@/lib/runs/service";

/** POST /api/runs/{runId}/cancel: marks the run cancelled; any later result is ignored (VS-11). */
export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const run = await cancelRun(a.session.user, (await params).runId);
  if (!run) return jsonError(409, "NOT_ACTIVE", "This run has already finished.");
  return json({ runId: run.id, status: run.status });
}
