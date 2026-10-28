import { apiSession, json, jsonError } from "@/lib/http";
import { getReportForUser } from "@/lib/db/repos/reports";
import type { Product } from "@/lib/db/schema";
import { reportVersions } from "@/lib/reports/versions";

/** GET /api/reports/{id}/versions: every run of the owner's report, newest first, with the inputs it used. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiSession();
  if ("error" in a) return a.error;
  const report = await getReportForUser(a.session.user.id, (await params).id);
  if (!report) return jsonError(404, "NOT_FOUND", "Report not found");
  const versions = await reportVersions(report.id, report.product as Product);
  return json({ reportId: report.id, versions });
}
