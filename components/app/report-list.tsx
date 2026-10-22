import Link from "next/link";
import { StatusBadge } from "./status-badge";
import { productInfo } from "@/lib/options/products";
import { formatRelative } from "@/lib/duration";
import { reportHref } from "@/lib/reports/service";
import type { Product, ReportStatus } from "@/lib/db/schema";

export type ReportListItem = { id: string; title: string; product: Product; status: ReportStatus; updatedAt: Date };

export function ReportList({ items }: { items: ReportListItem[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white" data-testid="report-list">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={reportHref(r)} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-ink no-underline hover:bg-cream sm:flex-nowrap">
            <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
            <span className="text-sm text-muted">{productInfo(r.product).name}</span>
            <StatusBadge status={r.status} />
            <time className="w-24 text-right text-xs text-muted" dateTime={r.updatedAt.toISOString()}>
              {formatRelative(r.updatedAt)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
