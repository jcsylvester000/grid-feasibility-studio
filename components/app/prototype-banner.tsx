import { pipelineStatus } from "@/lib/flags";

const PLURAL: Record<string, string> = {
  quick_report: "Quick Reports",
  executive_summary: "Executive Summaries",
  feasibility_report: "Feasibility Reports",
  teaser_intake: "Teaser Scans",
};
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Shown on every signed-in page while any product still runs on the stand-in pipeline (prototype). */
export function PrototypeBanner() {
  const { live, standIn } = pipelineStatus();
  return (
    <div role="note" data-print="hide" className="border-b border-warn/30 bg-warn-soft text-sm text-ink" data-testid="prototype-banner">
      <p className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
        <strong className="font-semibold text-warn">Prototype.</strong>{" "}
        {live.length > 0 ? (
          <>
            {list(live.map((p) => PLURAL[p]!))} run on GRID&apos;s live research pipeline.{" "}
            {standIn.length > 0 && (
              <>
                {list(standIn.map((p) => PLURAL[p]!))} are still produced by a stand-in pipeline from the answers you enter; their figures and wording are
                illustrative.
              </>
            )}
          </>
        ) : (
          <>
            Reports are produced by a stand-in pipeline from the answers you enter, until GRID&apos;s VectorShift research pipelines are connected. Figures and
            wording are illustrative, not research results.
          </>
        )}
      </p>
    </div>
  );
}

/** Inside a report (and on paper): this result came from the stand-in pipeline. */
export function PrototypeReportNotice() {
  return (
    <p role="note" className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-ink print:break-inside-avoid" data-testid="prototype-notice">
      <strong className="font-semibold text-warn">Prototype output.</strong> This report was produced by GRID&apos;s stand-in pipeline from the inputs entered,
      not by the live VectorShift research pipelines. Market figures, sources and wording are illustrative and must not be relied on.
    </p>
  );
}
