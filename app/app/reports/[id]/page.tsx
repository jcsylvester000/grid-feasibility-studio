import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { StatusBadge } from "@/components/app/status-badge";
import { LiveQuickReportView } from "@/components/report/live-quick-report";
import { PrintButton, RunAgainButton } from "@/components/report/report-actions";
import { VersionHistory } from "@/components/report/version-history";
import { ExecutiveSummaryView, FeasibilityReportView, QuickReportView, TeaserScanView } from "@/components/report/views";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { tokenInfoFor } from "@/lib/tokens/info";
import { UpgradePanel } from "@/components/report/upgrade-panel";
import { getReportForUser } from "@/lib/db/repos/reports";
import { envelopeForReportRun, latestEnvelopeForReport } from "@/lib/db/repos/runs";
import type { Product, RunInputSnapshot } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { productInfo } from "@/lib/options/products";
import { labelledInputs } from "@/lib/reports/inputs";
import { reportVersions } from "@/lib/reports/versions";
import { track } from "@/lib/usage/track";
import { isLiveEnvelope, normaliseLive } from "@/lib/vectorshift/quick-report-live";
import { PrototypeReportNotice } from "@/components/app/prototype-banner";
import { isStandInPipeline } from "@/lib/flags";

export const metadata: Metadata = { title: "Report" };

/* eslint-disable @typescript-eslint/no-explicit-any */
function ProductView({ product, payload, intake }: { product: string; payload: any; intake: Record<string, unknown> }) {
  if (product === "teaser_intake") return <TeaserScanView p={payload} confirmedReportId={(intake["teaser.confirmed_report_id"] as string) ?? null} />;
  if (product === "executive_summary") return <ExecutiveSummaryView p={payload} />;
  if (product === "feasibility_report") return <FeasibilityReportView p={payload} />;
  return <QuickReportView p={payload} />; // Quick Report 1.0 or 1.1 (with listing_source after a Teaser Scan)
}

function Notice({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  return (
    <p role="status" data-print="hide" className={tone === "info" ? "rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm" : "rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm"}>
      {children}
    </p>
  );
}

/**
 * S-05 report viewer. Renders only stored, validated envelopes, server-side, so the numbers on screen are
 * the payload's numbers (AC-030). Other users' ids and unknown ids give 404 (AC-031).
 * Versions: the newest successful run is shown, even while a new run is going or after one failed;
 * ?version={runId} shows an older one. Each version shows the inputs it used.
 */
export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const { id } = await params;
  const { version } = await searchParams;
  const { user } = await requireUser(`/app/reports/${id}`);
  const report = await getReportForUser(user.id, id);
  if (!report) notFound();
  if (report.product === "teaser_intake" && report.status === "needs_confirmation") redirect(`/app/reports/${report.id}/confirm`);
  const product = report.product as Product;

  const [latest, versions] = await Promise.all([latestEnvelopeForReport(report.id), reportVersions(report.id, product)]);
  const chosen = version ? await envelopeForReportRun(report.id, version) : null;
  if (version && !chosen) notFound();
  const stored = chosen ?? latest;
  const shownVersion = stored ? versions.find((v) => v.runId === stored.run.id) : undefined;
  const isOlder = !!(stored && latest && stored.run.id !== latest.run.id);
  const okCount = versions.filter((v) => v.number !== null).length;

  const body = stored?.envelope.envelope as Record<string, any> | undefined;
  const snap = stored?.run.inputSnapshot as RunInputSnapshot | null | undefined;
  const intakeForVersion = snap?.intake ?? report.intake;
  const live = isLiveEnvelope(body) ? normaliseLive(body.result) : null;
  const hasContent = !!(live?.ok || body?.report);
  if (hasContent) await track(user.publicId, "report.viewed", { product: report.product });

  const newest = versions[0];
  const runActive = report.status === "queued" || report.status === "running";
  const lastFailed = !runActive && newest && (newest.status === "failed" || newest.status === "cancelled") && newest.runId !== stored?.run.id;
  const formHref = `/app/new/${report.product}?id=${report.id}`;

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
          <p className="mt-1 text-sm text-muted" data-testid="version-line">
            {stored?.run.finishedAt
              ? `${shownVersion?.number ? `Version ${shownVersion.number} of ${okCount} · ` : ""}Generated ${formatDateTime(stored.run.finishedAt)}`
              : `Created ${formatDateTime(report.createdAt)}`}
            {` · User ${user.publicId}`}
          </p>
          {typeof report.intake["source.report_id"] === "string" && typeof report.intake["source.product"] === "string" && (
            <p className="mt-1 text-sm text-muted" data-testid="built-from">
              Built from your {productInfo(report.intake["source.product"] as Product).name}{" "}
              <Link href={`/app/reports/${report.intake["source.report_id"]}`}>{String(report.intake["source.title"] ?? "")}</Link>
            </p>
          )}
        </div>
        <div data-print="hide" className="flex flex-wrap items-start gap-2">
          {hasContent && <PrintButton reportId={report.id} />}
          {hasContent && !runActive && <RunAgainButton reportId={report.id} tokens={await tokenInfoFor(user.id, report.product)} />}
          {hasContent && !runActive && product !== "teaser_intake" && (
            <Link href={formHref} className={buttonVariants({ variant: "outline" })} data-testid="edit-and-rerun">
              Edit inputs and run again
            </Link>
          )}
          <ConfirmDelete id={report.id} title={report.title} />
        </div>
      </header>

      {hasContent && !runActive && <UpgradePanel reportId={report.id} product={report.product} />}

      {runActive && (
        <Notice tone="info">
          A new version is being prepared.{" "}
          <Link href={`/app/reports/${report.id}/run`}>See run status</Link>
          {hasContent ? " The version below stays available." : ""}
        </Notice>
      )}
      {lastFailed && hasContent && (
        <Notice tone="warn">
          The latest run did not finish: {newest!.errorMessage} <Link href={`/app/reports/${report.id}/run`}>See run status</Link>. Showing the last
          successful version.
        </Notice>
      )}
      {isOlder && (
        <Notice tone="warn">
          You are viewing version {shownVersion?.number} of {okCount}, generated {formatDateTime(stored!.run.finishedAt!)}.{" "}
          <Link href={`/app/reports/${report.id}`}>View the latest version</Link>
        </Notice>
      )}

      {live?.ok ? (
        <div data-testid="report-view" data-product={report.product} data-format="live" className="space-y-6">
          <LiveQuickReportView r={live.value} intake={intakeForVersion} inputs={labelledInputs(product, intakeForVersion)} reportRef={body?.report_ref ?? null} />
        </div>
      ) : body?.report ? (
        <div data-testid="report-view" data-product={report.product} className="space-y-6">
          {isStandInPipeline(stored?.run.pipelineId) && <PrototypeReportNotice />}
          <ProductView product={report.product} payload={body.report} intake={report.intake} />
        </div>
      ) : body ? (
        <Notice tone="warn">
          This version could not be displayed. Its full output is kept:{" "}
          <a href={`/api/reports/${report.id}/versions/${stored!.run.id}`} download>download the JSON</a>.
        </Notice>
      ) : report.status === "failed" || runActive ? (
        <Link href={`/app/reports/${report.id}/run`} className={buttonVariants({ variant: "outline" })}>
          See run status
        </Link>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line-2 bg-white p-6">
          <p className="font-medium">This report has not been generated yet.</p>
          <Link href={formHref} className="text-sm">
            Continue the form
          </Link>
        </div>
      )}

      <VersionHistory reportId={report.id} versions={versions} shownRunId={stored?.run.id ?? null} />

      <Link href="/app/reports" className="text-sm" data-print="hide">
        Back to my reports
      </Link>
    </article>
  );
}
