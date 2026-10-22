import { apiSession, json, jsonError } from "@/lib/http";
import { getReportForUser } from "@/lib/db/repos/reports";
import { listFilesForReport } from "@/lib/db/repos/files";
import { fileView } from "@/lib/files/service";

/** GET /api/reports/{id}/files: the owner's files for a report (names shown to the owner only, UP-07). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiSession();
  if ("error" in a) return a.error;
  const report = await getReportForUser(a.session.user.id, (await params).id);
  if (!report) return jsonError(404, "NOT_FOUND", "Report not found");
  return json({ files: (await listFilesForReport(report.id)).map(fileView) });
}
