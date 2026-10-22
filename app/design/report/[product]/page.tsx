import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExecutiveSummaryView, FeasibilityReportView, QuickReportView } from "@/components/report/views";
import { SAMPLE_KEYS, samplePayload, type SampleKey } from "@/lib/report/samples";

export const metadata: Metadata = { title: "Report viewer sample", robots: { index: false, follow: false } };

/**
 * Internal design board for the report viewer (B5), rendering the golden payloads. Only served when
 * DESIGN_SAMPLES=true (local and end-to-end runs); 404 in production.
 */
export default async function ReportSample({ params }: { params: Promise<{ product: string }> }) {
  if (process.env.DESIGN_SAMPLES !== "true") notFound();
  const { product } = await params;
  if (!SAMPLE_KEYS.includes(product as SampleKey)) notFound();
  const { product: p, payload } = samplePayload(product as SampleKey);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="eyebrow mb-6" data-print="hide">Internal · report viewer sample · {product}</p>
      <div data-testid="report-view" data-product={p}>
        {p === "executive_summary" ? <ExecutiveSummaryView p={payload} /> : p === "feasibility_report" ? <FeasibilityReportView p={payload} /> : <QuickReportView p={payload} />}
      </div>
    </main>
  );
}
