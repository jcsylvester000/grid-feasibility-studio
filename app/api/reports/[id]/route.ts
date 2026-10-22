import { apiSession, json, jsonError } from "@/lib/http";
import { getReportForUser } from "@/lib/db/repos/reports";
import { removeReport, saveReport } from "@/lib/reports/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/reports/{id}: the owner's report (the stored envelope is added in batch B5). */
export async function GET(_req: Request, { params }: Ctx) {
  const a = await apiSession();
  if ("error" in a) return a.error;
  const report = await getReportForUser(a.session.user.id, (await params).id);
  if (!report) return jsonError(404, "NOT_FOUND", "Report not found");
  return json({ report });
}

/** PATCH /api/reports/{id} { title?, intake? }: autosave (S-03). */
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const result = await saveReport(a.session.user, (await params).id, await req.json().catch(() => null));
  if (!result.ok) return jsonError(result.status, result.status === 404 ? "NOT_FOUND" : "INPUT_INVALID", result.error);
  return json({ id: result.report.id, updatedAt: result.report.updatedAt });
}

/** DELETE /api/reports/{id}: removes the report, its runs, envelopes and files. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  if (!(await removeReport(a.session.user, (await params).id))) return jsonError(404, "NOT_FOUND", "Report not found");
  return new Response(null, { status: 204 });
}
