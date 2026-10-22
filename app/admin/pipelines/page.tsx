import type { Metadata } from "next";
import { fmtAt, fmtInt, fmtMs, fmtPct } from "@/components/admin/ui";
import { pipelines } from "@/lib/admin/service";

export const metadata: Metadata = { title: "Pipelines" };

/** AD-05 Pipelines: one card per product with health and warnings (AC-043). */
export default async function AdminPipelines() {
  const list = await pipelines();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">Pipelines</h1>
        <p className="mt-1 text-sm text-muted">A warning shows when p95 run time is above 80% of the timeout or the 7-day success rate is under 95%.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((p) => (
          <section key={p.product} aria-labelledby={`pl-${p.product}`} className="rounded-xl border border-line bg-white p-5" data-testid={`pipeline-${p.product}`}>
            <h2 id={`pl-${p.product}`} className="text-xl capitalize">{p.product.replace(/_/g, " ")}</h2>
            <p className="mt-0.5 break-all font-mono text-xs text-muted">{p.pipelineId ?? "No pipeline id set"}</p>
            {p.warnings.map((w) => (
              <p key={w} role="status" className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" data-testid="pipeline-warning">{w}</p>
            ))}
            {p.runs30 === 0 ? (
              <p className="mt-4 text-sm text-muted">No runs yet for this pipeline.</p>
            ) : (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <Stat k="Runs (7 days)" v={fmtInt(p.runs7)} />
                <Stat k="Success (7 days)" v={fmtPct(p.successRate7)} />
                <Stat k="Success (30 days)" v={fmtPct(p.successRate30)} />
                <Stat k="p50 time" v={fmtMs(p.p50Ms)} />
                <Stat k="p95 time" v={fmtMs(p.p95Ms)} />
                <Stat k="Timeout" v={fmtMs(p.timeoutMs)} />
                <Stat k="In flight" v={`${p.inFlight} of ${p.maxConcurrent}`} />
                <Stat k="Last success" v={fmtAt(p.lastSuccess)} />
                <Stat k="Top errors (30 days)" v={p.topCodes.length ? p.topCodes.map((c) => `${c.code} (${c.n})`).join(", ") : "None"} />
              </dl>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
