import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { StatusBadge } from "@/components/app/status-badge";
import { PrintButton, RunAgainButton } from "@/components/report/report-actions";
import { ExecutiveSummaryView, FeasibilityReportView, QuickReportView, TeaserScanView } from "@/components/report/views";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getReportForUser } from "@/lib/db/repos/reports";
import { latestEnvelopeForReport } from "@/lib/db/repos/runs";
import { formatDate } from "@/lib/format";
import { productInfo } from "@/lib/options/products";
import { track } from "@/lib/usage/track";

export const metadata: Metadata = { title: "Report" };

/* eslint-disable @typescript-eslint/no-explicit-any */
function ProductView({ product, payload, intake }: { product: string; payload: any; intake: Record<string, unknown> }) {
  if (product === "teaser_intake") return <TeaserScanView p={payload} confirmedReportId={(intake["teaser.confirmed_report_id"] as string) ?? null} />;
  if (product === "executive_summary") return <ExecutiveSummaryView p={payload} />;
  if (product === "feasibility_report") return <FeasibilityReportView p={payload} />;
  return <QuickReportView p={payload} />; // Quick Report 1.0 or 1.1 (with listing_source after a Teaser Scan)
}

/**
 * S-05 report viewer. Renders only stored, validated envelopes, server-side, so the numbers on screen are
 * the payload's numbers (AC-030). Other users' ids and unknown ids give 404 (AC-031).
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser(`/app/reports/${id}`);
  const report = await getReportForUser(user.id, id);
  if (!report) notFound();
  if (report.product === "teaser_intake" && report.status === "needs_confirmation") redirect(`/app/reports/${report.id}/confirm`);
  const stored = report.status === "ready" ? await latestEnvelopeForReport(report.id) : null;
  const env = stored?.envelope.envelope as { report?: unknown; generated_at?: string } | undefined;
  if (env?.report) await track(user.publicId, "report.viewed", { product: report.product });

  return (
    <article className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6 print:border-bronze">
        <div className="min-w-0">
          <p className="eyebrow">{productInfo(report.product).name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl">{report.title}</h1>
            <span data-print="hide">
              <StatusBadge status={report.status} />
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {stored?.run.finishedAt ? `Generated ${formatDate(stored.run.finishedAt)}` : `Created ${formatDate(report.createdAt)}`}
            {` · User ${user.publicId}`}
          </p>
        </div>
        <div data-print="hide" className="flex flex-wrap items-start gap-2">
          {env?.report ? (
            <>
              <PrintButton reportId={report.id} />
              <RunAgainButton reportId={report.id} />
            </>
          ) : null}
          <ConfirmDelete id={report.id} title={report.title} />
        </div>
      </header>

      {env?.report ? (
        <div data-testid="report-view" data-product={report.product}>
          <ProductView product={report.product} payload={env.report} intake={report.intake} />
        </div>
      ) : report.status === "failed" || report.status === "queued" || report.status === "running" ? (
        <Link href={`/app/reports/${report.id}/run`} className={buttonVariants({ variant: "outline" })}>
          See run status
        </Link>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line-2 bg-white p-6">
          <p className="font-medium">This report has not been generated yet.</p>
          <Link href={`/app/new/${report.product}?id=${report.id}`} className="text-sm">
            Continue the form
          </Link>
        </div>
      )}
      <Link href="/app/reports" className="text-sm" data-print="hide">
        Back to my reports
      </Link>
    </article>
  );
}
