import { apiSession, jsonError } from "@/lib/http";
import { getReportForUser } from "@/lib/db/repos/reports";
import { envelopeForRun, getRunForUser } from "@/lib/db/repos/runs";
import type { Product, RunInputSnapshot } from "@/lib/db/schema";
import { labelledInputs } from "@/lib/reports/inputs";
import { reportVersions } from "@/lib/reports/versions";

/**
 * GET /api/reports/{id}/versions/{runId}: one version as a JSON download: what was entered, what was sent
 * to the pipeline, and the stored output. Owner only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const a = await apiSession();
  if ("error" in a) return a.error;
  const { id, runId } = await params;
  const report = await getReportForUser(a.session.user.id, id);
  const row = report ? await getRunForUser(a.session.user.id, runId) : null;
  if (!report || !row || row.run.reportId !== report.id) return jsonError(404, "NOT_FOUND", "Version not found");
  const product = report.product as Product;
  const snap = row.run.inputSnapshot as RunInputSnapshot | null;
  const version = (await reportVersions(report.id, product)).find((v) => v.runId === runId);
  const env = await envelopeForRun(runId);
  const body = {
    report: { id: report.id, title: report.title, product },
    version: {
      number: version?.number ?? null,
      run_id: runId,
      status: row.run.status,
      error_code: row.run.errorCode,
      queued_at: row.run.queuedAt,
      finished_at: row.run.finishedAt,
      pipeline_id: row.run.pipelineId,
      vectorshift_run_id: row.run.vsRunId,
    },
    inputs: snap ? { entered: labelledInputs(product, snap.intake), sent_to_pipeline: snap.sent ?? null, report_ref: snap.report_ref ?? null } : null,
    output: env ? { schema_version: env.schemaVersion, body: env.envelope } : null,
  };
  const name = `${report.title.replace(/[^A-Za-z0-9 _.-]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "report"}-v${version?.number ?? "run"}.json`;
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
