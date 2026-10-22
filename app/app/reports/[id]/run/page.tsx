import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RunStatus } from "@/components/runs/run-status";
import { requireUser } from "@/lib/auth/session";
import { getReportForUser } from "@/lib/db/repos/reports";
import { latestRunForReport } from "@/lib/db/repos/runs";
import { productInfo } from "@/lib/options/products";
import { getRunStatus } from "@/lib/runs/service";

export const metadata: Metadata = { title: "Run status" };

/** S-04: progress and outcome of the latest run of a report. Closing the tab does not start a new run (AC-027). */
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser(`/app/reports/${id}/run`);
  const report = await getReportForUser(user.id, id);
  if (!report) notFound();
  const latest = await latestRunForReport(report.id);
  if (!latest) redirect(`/app/new/${report.product}?id=${report.id}`);
  const view = await getRunStatus(user, latest.id);
  if (!view) notFound();
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">{productInfo(report.product).name}</p>
        <h1 className="mt-2 text-3xl">{report.title}</h1>
      </header>
      <RunStatus initial={view} formHref={`/app/new/${report.product}?id=${report.id}`} />
    </div>
  );
}
