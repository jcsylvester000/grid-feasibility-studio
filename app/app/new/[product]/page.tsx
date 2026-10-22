import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/app/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getReportForUser } from "@/lib/db/repos/reports";
import { productInfo } from "@/lib/options/products";
import { isEnabledProduct } from "@/lib/reports/service";
import { startReportAction } from "../../actions";

export const metadata: Metadata = { title: "Report form" };

type Props = { params: Promise<{ product: string }>; searchParams: Promise<{ id?: string }> };

/** S-03 shell. The step forms arrive in B4 (Quick Report) and B6 (Executive Summary, Feasibility Report). */
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

  return (
    <div className="space-y-6" data-testid="report-form" data-report-id={report.id}>
      <header>
        <p className="eyebrow">{info.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{report.title}</h1>
          <StatusBadge status={report.status} />
        </div>
      </header>
      <div className="rounded-[var(--radius-card)] border border-dashed border-line-2 bg-white p-6">
        <p className="font-medium">The {info.name} form arrives in the next batch.</p>
        <p className="mt-1 text-sm text-muted">This draft is saved. It needs: {info.needs.toLowerCase()}.</p>
      </div>
      <Link href="/app/reports" className="text-sm">Back to my reports</Link>
    </div>
  );
}
