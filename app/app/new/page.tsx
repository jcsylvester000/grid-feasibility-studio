import type { Metadata } from "next";
import { NewReportChooser } from "@/components/app/new-report-chooser";
import { productsWithTypicalTimes } from "@/lib/reports/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New report" };

export default async function NewReportPage() {
  await requireUser("/app/new");
  const products = await productsWithTypicalTimes();
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">New report</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Which report do you need?</h1>
        <p className="mt-2 max-w-2xl text-muted">Each report answers a different question and needs different inputs.</p>
      </header>
      <NewReportChooser
        products={products.map((p) => ({
          key: p.key, name: p.name, short: p.answers, needs: p.needs, typicalMs: p.typicalMs, typicalIsEstimate: p.typicalIsEstimate,
        }))}
      />
    </div>
  );
}
