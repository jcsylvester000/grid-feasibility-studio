import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { StatusBadge } from "@/components/app/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getReportForUser } from "@/lib/db/repos/reports";
import { formatDate } from "@/lib/format";
import { productInfo } from "@/lib/options/products";
import { latestEnvelopeForReport } from "@/lib/db/repos/runs";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Report" };

/** S-05 shell: the block-rendered report viewer arrives in batch B5. Other users' ids give 404 (AC-031). */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser(`/app/reports/${id}`);
  const report = await getReportForUser(user.id, id);
  if (!report) notFound();
  const stored = report.status === "ready" ? await latestEnvelopeForReport(report.id) : null;
  const payload = stored?.envelope.envelope.report as { indicative?: { label?: string; headline?: string } } | undefined;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{productInfo(report.product).name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl">{report.title}</h1>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-1 text-sm text-muted">Created {formatDate(report.createdAt)}</p>
        </div>
        <ConfirmDelete id={report.id} title={report.title} />
      </header>
      {payload?.indicative ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6" data-testid="report-summary">
          <p className="eyebrow">Indicative rating</p>
          <p className="mt-2 text-2xl">{payload.indicative.label}</p>
          <p className="mt-2 text-muted">{payload.indicative.headline}</p>
          <p className="mt-4 text-xs text-muted">The full report viewer and print layout arrive in batch B5.</p>
        </div>
      ) : stored ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6" data-testid="report-summary">
          <p className="font-medium">Report ready. The full report viewer arrives in batch B5.</p>
        </div>
      ) : report.status === "failed" || report.status === "queued" || report.status === "running" ? (
        <Link href={`/app/reports/${report.id}/run`} className={buttonVariants({ variant: "outline" })}>See run status</Link>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line-2 bg-white p-6">
          <p className="font-medium">This report has not been generated yet.</p>
          <Link href={`/app/new/${report.product}?id=${report.id}`} className="text-sm">Continue the form</Link>
        </div>
      )}
      <Link href="/app/reports" className="text-sm">Back to my reports</Link>
    </div>
  );
}
