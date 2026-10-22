import { runDetail } from "@/lib/db/repos/admin";
import { apiAdmin, json, jsonError } from "@/lib/http";

/** GET /api/admin/runs/{id}: timestamps, HTTP status and VectorShift run id; no report content (AC-042). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAdmin();
  if ("error" in a) return a.error;
  const r = await runDetail((await params).id);
  return r ? json({ run: r }) : jsonError(404, "NOT_FOUND", "Run not found");
}
