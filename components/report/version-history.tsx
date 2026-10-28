/** Version history on the report page (server component). Each version keeps its own inputs and output. */
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { VersionItem } from "@/lib/reports/versions";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: "ok" | "bad" | "info" | "neutral" }> = {
  succeeded: { label: "Ready", tone: "ok" },
  failed: { label: "Failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  queued: { label: "Queued", tone: "info" },
  running: { label: "Running", tone: "info" },
};

export function VersionHistory({ reportId, versions, shownRunId }: { reportId: string; versions: VersionItem[]; shownRunId: string | null }) {
  if (!versions.length) return null;
  const latestOk = versions.find((v) => v.number !== null);
  return (
    <section aria-labelledby="versions" className="space-y-3" data-print="hide" data-testid="version-history">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="versions" className="text-xl">Versions</h2>
        <p className="text-xs text-muted">Every run is kept. Running again, with the same or edited answers, adds a new version.</p>
      </div>
      <ol className="divide-y divide-line rounded-xl border border-line bg-white">
        {versions.map((v) => {
          const s = STATUS[v.status] ?? STATUS.queued!;
          const shown = v.runId === shownRunId;
          return (
            <li key={v.runId} className={cn("px-4 py-3", shown && "bg-bronze-soft/50")} data-testid="version-row" data-version={v.number ?? ""}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{v.number !== null ? `Version ${v.number}` : "Run"}</span>
                <Badge tone={s.tone}>{s.label}</Badge>
                <span className="text-sm text-muted">{formatDateTime(v.at)}</span>
                {v.number !== null && latestOk?.runId === v.runId && <Badge tone="brand">Latest</Badge>}
                {shown && <span className="text-xs font-medium text-bronze-ink">Shown above</span>}
                <span className="ml-auto flex flex-wrap gap-3 text-sm">
                  {v.number !== null && !shown && (
                    <Link href={`/app/reports/${reportId}?version=${v.runId}`} data-testid="view-version">
                      View
                    </Link>
                  )}
                  {v.status !== "queued" && v.status !== "running" && (
                    <a href={`/api/reports/${reportId}/versions/${v.runId}`} download>
                      Download JSON
                    </a>
                  )}
                </span>
              </div>
              {v.errorMessage && <p className="mt-1 text-sm text-bad">{v.errorMessage}</p>}
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-muted">Inputs used{v.reportRef ? ` · Ref ${v.reportRef}` : ""}</summary>
                {v.inputs ? (
                  <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[220px_1fr]">
                    {v.inputs.map((i) => (
                      <div key={i.key} className="contents">
                        <dt className="text-muted">{i.label}</dt>
                        <dd>{i.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-muted">Inputs were not recorded for this run (it was made before version history was added).</p>
                )}
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
