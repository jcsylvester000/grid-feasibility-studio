import { apiSession, json, jsonError } from "@/lib/http";
import { getRunStatus } from "@/lib/runs/service";

/** GET /api/runs/{runId}: { status, step, elapsedMs, typicalMs, errorCode? } for the run status page. */
export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const a = await apiSession();
  if ("error" in a) return a.error;
  const view = await getRunStatus(a.session.user, (await params).runId);
  if (!view) return jsonError(404, "NOT_FOUND", "Run not found");
  return json(view);
}
