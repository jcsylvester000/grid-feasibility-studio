import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportForm } from "@/components/forms/report-form";
import { tokenInfoFor } from "@/lib/tokens/info";
import { FORMS } from "@/lib/forms";
import { quickReportNotAsked } from "@/lib/forms/quick-report";
import { getOptions } from "@/lib/options";
import type { Product } from "@/lib/db/schema";
import { StatusBadge } from "@/components/app/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getReportForUser } from "@/lib/db/repos/reports";
import { productInfo } from "@/lib/options/products";
import { isEnabledProduct } from "@/lib/reports/service";
import { startReportAction } from "../../actions";
import { listFilesForReport } from "@/lib/db/repos/files";
import { fileView } from "@/lib/files/service";
import { uploadDriver } from "@/lib/files/storage";
import { listRunsForReport } from "@/lib/db/repos/runs";
import { getReportForUser as getSource } from "@/lib/db/repos/reports";
import { VALIDATORS } from "@/lib/forms/validators";
import { sourceInfo } from "@/lib/reports/sources";
import { DOC_TYPES } from "@/lib/files/config";

export const metadata: Metadata = { title: "Report form" };

type Props = { params: Promise<{ product: string }>; searchParams: Promise<{ id?: string }> };

/** S-03 report form: Quick Report (B4), Executive Summary and Feasibility Report with documents (B6). */
export default async function ReportFormPage({ params, searchParams }: Props) {
  const { product } = await params;
  const { id } = await searchParams;
  const { user } = await requireUser(`/app/new/${product}${id ? `?id=${id}` : ""}`);
  if (!isEnabledProduct(product)) notFound();
  const info = productInfo(product);

  if (!id) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-3xl">{info.name}</h1>
        <p className="text-muted">{info.answers}</p>
        <form action={startReportAction}>
          <input type="hidden" name="product" value={product} />
          <button type="submit" className={buttonVariants()}>Start a new {info.name}</button>
        </form>
      </div>
    );
  }

  const report = await getReportForUser(user.id, id);
  if (!report || report.product !== product) notFound();
  if (report.status === "queued" || report.status === "running") redirect(`/app/reports/${report.id}/run`);
  const form = FORMS[product as Product];
  const files = form?.steps.some((s) => s.documents) ? await listFilesForReport(report.id) : [];
  const versionCount = (await listRunsForReport(report.id)).filter((r) => r.status === "succeeded").length;
  // Started from another report: banner, approximate-value hints, inherited documents, and open on the
  // first step that still needs an answer (so the user lands on what is new).
  const source = await sourceInfo(user.id, report.intake);
  const sourceReport = source?.exists ? await getSource(user.id, source.reportId) : null;
  const inherited = sourceReport && FORMS[sourceReport.product as Product]?.steps.some((s) => s.documents)
    ? (await listFilesForReport(sourceReport.id)).map((f) => ({ name: f.name, docType: f.docType ?? null, label: DOC_TYPES.find((d) => d.value === f.docType)?.label ?? "Document" }))
    : [];
  let initialStep = 0;
  if (source && form && versionCount === 0) {
    const issues = VALIDATORS[product as Product]?.(report.intake, { fields: getOptions(product as Product).fields, locations: getOptions(product as Product).locations }).issues ?? [];
    const first = form.steps.findIndex((s) => issues.some((i) => i.step === s.key));
    initialStep = first >= 0 ? first : form.steps.length;
  }

  return (
    <div className="space-y-6" data-testid="report-form" data-report-id={report.id}>
      <header>
        <p className="eyebrow">{info.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{report.title}</h1>
          <StatusBadge status={report.status} />
        </div>
        {versionCount > 0 && (
          <p className="mt-3 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm" data-testid="new-version-note">
            This report has {versionCount} version{versionCount === 1 ? "" : "s"}. Change any answers, then generate: you get version {versionCount + 1}{" "}
            dated today, and earlier versions stay available on the <Link href={`/app/reports/${report.id}`}>report page</Link>.
          </p>
        )}
      </header>
      {form ? (
        <ReportForm
          reportId={report.id}
          product={product}
          uploadDriver={uploadDriver()}
          initialFiles={files.map(fileView)}
          productName={info.name}
          steps={form.steps}
          fields={getOptions(product as Product).fields}
          locations={getOptions(product as Product).locations}
          initialIntake={report.intake}
          notAsked={product === "quick_report" ? quickReportNotAsked : []}
          titleFor={{ prefix: info.name, fallback: report.title }}
          tokens={await tokenInfoFor(user.id, product as Product)}
          source={source ? { productName: source.productName, title: source.title, finishedOn: source.finishedOn, ageDays: source.ageDays, reuse: source.reuse, carried: source.carried, href: source.exists ? `/app/reports/${source.reportId}` : null } : null}
          approx={source?.approx ?? {}}
          inheritedFiles={inherited}
          initialStep={initialStep}
        />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line-2 bg-white p-6">
          <p className="font-medium">The {info.name} form arrives in a later batch.</p>
          <p className="mt-1 text-sm text-muted">This draft is saved. It needs: {info.needs.toLowerCase()}.</p>
        </div>
      )}
      <Link href="/app/reports" className="text-sm">Back to my reports</Link>
    </div>
  );
}
