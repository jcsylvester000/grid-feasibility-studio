import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/app/product-card";
import { ReportList } from "@/components/app/report-list";
import { Skeleton } from "@/components/ui/skeleton";
import { listReports } from "@/lib/db/repos/reports";
import { requireUser } from "@/lib/auth/session";
import { productsWithTypicalTimes } from "@/lib/reports/service";

export const metadata: Metadata = { title: "Dashboard" };

async function Recent({ userId }: { userId: string }) {
  const { items } = await listReports(userId, { pageSize: 8 });
  if (!items.length)
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line-2 bg-white px-6 py-10 text-center">
        <p className="font-medium">No reports yet</p>
        <p className="mt-1 text-sm text-muted">Pick a report above to start your first one.</p>
      </div>
    );
  return <ReportList items={items} />;
}

export default async function Dashboard() {
  const { user } = await requireUser("/app");
  const products = await productsWithTypicalTimes();
  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Start a report</h1>
      </header>
      <section aria-label="Products" className={`grid gap-4 sm:grid-cols-2 ${products.length > 3 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {products.map((p) => (
          <ProductCard key={p.key} p={p} />
        ))}
      </section>
      <section aria-labelledby="recent" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="recent" className="text-2xl">Recent reports</h2>
          <Link href="/app/reports" className="text-sm">See all</Link>
        </div>
        <Suspense
          fallback={
            <div className="space-y-2" role="status" aria-label="Loading reports">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          }
        >
          <Recent userId={user.id} />
        </Suspense>
      </section>
    </div>
  );
}
