import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { StatusBadge } from "@/components/app/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getReportForUser } from "@/lib/db/repos/reports";
import { formatDate } from "@/lib/format";
import { productInfo } from "@/lib/options/products";

export const metadata: Metadata = { title: "Report" };

/** S-05 shell: the block-rendered report viewer arrives in batch B5. Other users' ids give 404 (AC-031). */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser(`/app/reports/${id}`);
  const report = await getReportForUser(user.id, id);
  if (!report) notFound();
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
      <div className="rounded-[var(--radius-card)] border border-dashed border-line-2 bg-white p-6">
        <p className="font-medium">The report viewer arrives in batch B5.</p>
      </div>
      <Link href="/app/reports" className="text-sm">Back to my reports</Link>
    </div>
  );
}
