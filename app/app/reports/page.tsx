import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { StatusBadge } from "@/components/app/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { listReports, type ReportFilters } from "@/lib/db/repos/reports";
import { formatRelative } from "@/lib/duration";
import { productInfo } from "@/lib/options/products";
import { enabledProducts, productSchema, reportHref, STATUS_LABEL, statusSchema } from "@/lib/reports/service";
import { REPORT_STATUSES } from "@/lib/db/schema";

export const metadata: Metadata = { title: "My reports" };

type SP = { q?: string; product?: string; status?: string; page?: string; deleted?: string };

const selectCls = "h-11 rounded-lg border border-line-2 bg-white px-3 text-[15px]";

export default async function MyReports({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { user } = await requireUser("/app/reports");
  const product = productSchema.safeParse(sp.product || undefined);
  const status = statusSchema.safeParse(sp.status || undefined);
  const page = Math.max(Number(sp.page) || 1, 1);
  const filters = { q: sp.q?.trim() || undefined, product: product.success ? product.data : undefined, status: status.success ? status.data : undefined };
  const filtered = !!(filters.q || filters.product || filters.status);

  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { q: filters.q, product: filters.product, status: filters.status, page: String(page), ...over };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const back = `/app/reports${qs({}) || "?"}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My reports</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">My reports</h1>
        </div>
        <Link href="/app/new" className={buttonVariants()}>New report</Link>
      </header>

      {sp.deleted && (
        <p role="status" className="rounded-lg bg-ok-soft px-4 py-2 text-sm text-ok">The report was deleted.</p>
      )}

      <form method="get" className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] [&>*]:min-w-0" role="search">
        <label className="sr-only" htmlFor="q">Search by title</label>
        <Input id="q" name="q" placeholder="Search by title" defaultValue={filters.q} />
        <label className="sr-only" htmlFor="product">Product</label>
        <select id="product" name="product" defaultValue={filters.product ?? ""} className={selectCls}>
          <option value="">All products</option>
          {enabledProducts().map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={filters.status ?? ""} className={selectCls}>
          <option value="">All statuses</option>
          {REPORT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button type="submit" className={buttonVariants({ variant: "dark", className: "h-11" })}>Apply</button>
      </form>

      <Suspense
        key={JSON.stringify({ ...filters, page })}
        fallback={
          <div className="space-y-2" role="status" aria-label="Loading reports">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        }
      >
        <Results userId={user.id} filters={filters} page={page} filtered={filtered} qs={qs} back={back} />
      </Suspense>
    </div>
  );
}

async function Results({
  userId, filters, page, filtered, qs, back,
}: {
  userId: string;
  filters: Pick<ReportFilters, "q" | "product" | "status">;
  page: number;
  filtered: boolean;
  qs: (over: Partial<SP>) => string;
  back: string;
}) {
  const { items, total, pageSize } = await listReports(userId, { ...filters, page, pageSize: 25 });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      {items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line-2 bg-white px-6 py-12 text-center">
          {filtered ? (
            <>
              <p className="font-medium">No reports match</p>
              <Link href="/app/reports" className="mt-2 inline-block text-sm">Clear filters</Link>
            </>
          ) : (
            <>
              <p className="font-medium">No reports yet</p>
              <Link href="/app/new" className="mt-2 inline-block text-sm">Start your first report</Link>
            </>
          )}
        </div>
      ) : (
        <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white md:overflow-visible">
          <table className="w-full min-w-[640px] text-left text-sm md:min-w-0" data-testid="reports-table">
            <thead className="bg-sand text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Title</th>
                <th scope="col" className="px-4 py-3 font-medium">Product</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Updated</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-3"><Link href={reportHref(r)} className="font-medium text-ink">{r.title}</Link></td>
                  <td className="px-4 py-3 text-muted">{productInfo(r.product).name}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-muted"><time dateTime={r.updatedAt.toISOString()}>{formatRelative(r.updatedAt)}</time></td>
                  <td className="px-4 py-3 text-right"><ConfirmDelete id={r.id} title={r.title} back={back} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {pages} · {total} reports</span>
          <span className="flex gap-2">
            {page > 1 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/app/reports${qs({ page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/app/reports${qs({ page: String(page + 1) })}`}>Next</Link>}
          </span>
        </nav>
      )}
    </>
  );
}
