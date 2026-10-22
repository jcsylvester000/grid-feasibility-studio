import type { Metadata } from "next";
import Link from "next/link";
import { Empty, fmtAt, fmtBytes, fmtMs, Pager } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { listRuns, runDetail } from "@/lib/db/repos/admin";
import { PRODUCTS } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Runs" };

type Search = Promise<Record<string, string | undefined>>;
const TONE: Record<string, "ok" | "bad" | "info" | "neutral"> = { succeeded: "ok", failed: "bad", running: "info", queued: "info", cancelled: "neutral" };

/** AD-04 Runs: metadata only (admin_runs_v). A run id opens a side panel for support with VectorShift (AC-042). */
export default async function AdminRuns({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const list = await listRuns({ product: sp.product, status: sp.status, code: sp.code, from: sp.from, to: sp.to, page });
  const open = sp.run ? await runDetail(sp.run) : null;
  const keep = Object.fromEntries(Object.entries({ product: sp.product, status: sp.status, code: sp.code, from: sp.from, to: sp.to }).filter(([, v]) => v)) as Record<string, string>;
  const href = (o: Record<string, string>) => `/admin/runs?${new URLSearchParams({ ...keep, ...o }).toString()}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">Runs</h1>
        <p className="mt-1 text-sm text-muted">No inputs, outputs or file names are shown.</p>
      </header>
      <form action="/admin/runs" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4">
        <Select id="product" label="Product" value={sp.product} options={PRODUCTS.map((p) => [p, p.replace(/_/g, " ")])} />
        <Select id="status" label="Status" value={sp.status} options={["queued", "running", "succeeded", "failed", "cancelled"].map((s) => [s, s])} />
        <Select id="code" label="Error code" value={sp.code} options={list.codes.map((c) => [c, c])} />
        <div className="space-y-1">
          <label htmlFor="from" className="block text-xs font-medium text-muted">From</label>
          <input id="from" name="from" type="date" defaultValue={sp.from} className="h-10 rounded-lg border border-line-2 bg-white px-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="block text-xs font-medium text-muted">To</label>
          <input id="to" name="to" type="date" defaultValue={sp.to} className="h-10 rounded-lg border border-line-2 bg-white px-2 text-sm" />
        </div>
        <button type="submit" className="h-10 rounded-lg bg-navy px-4 text-sm font-medium text-white">Apply</button>
        <a href={`/api/admin/export.csv?${new URLSearchParams({ view: "runs", range: "90d" })}`} className="ml-auto h-10 rounded-lg border border-line-2 bg-white px-4 text-sm leading-10 no-underline hover:border-bronze">
          Export CSV
        </a>
      </form>

      <div className={open ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] [&>*]:min-w-0" : ""}>
        {list.items.length === 0 ? (
          <Empty>No runs match.</Empty>
        ) : (
          <div tabIndex={0} className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[860px] text-left text-sm" data-testid="runs-table">
              <thead className="bg-sand text-muted">
                <tr>
                  {["Run", "User ID", "Product", "Pipeline", "Status", "Error code", "Duration", "Started"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.items.map((r) => (
                  <tr key={r.id} className={`border-t border-line ${open?.id === r.id ? "bg-cream" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs"><Link href={href({ run: r.id, page: String(page) })}>{r.id.slice(0, 8)}</Link></td>
                    <td className="px-3 py-2 font-mono text-xs"><Link href={`/admin/users/${r.user_public_id}`}>{r.user_public_id}</Link></td>
                    <td className="px-3 py-2">{r.product.replace(/_/g, " ")}</td>
                    <td className="max-w-40 truncate px-3 py-2 font-mono text-xs" title={r.pipeline_id ?? ""}>{r.pipeline_id ?? "—"}</td>
                    <td className="px-3 py-2"><Badge tone={TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                    <td className="px-3 py-2 font-mono text-xs">{r.error_code ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtMs(r.duration_ms)}</td>
                    <td className="px-3 py-2">{fmtAt(r.started_at ?? r.queued_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {open && (
          <aside aria-labelledby="run-panel" className="h-fit rounded-xl border border-line bg-white p-4" data-testid="run-panel">
            <div className="flex items-center justify-between">
              <h2 id="run-panel" className="font-sans text-sm font-semibold">Run {open.id.slice(0, 8)}</h2>
              <Link href={href({ page: String(page) })} className="text-sm">Close</Link>
            </div>
            <dl className="mt-3 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">
              {(
                [
                  ["Run id", open.id],
                  ["User ID", open.user_public_id],
                  ["Product", open.product],
                  ["Pipeline id", open.pipeline_id ?? "—"],
                  ["Attempt", String(open.attempt)],
                  ["Status", open.status],
                  ["Last phase", open.phase],
                  ["Error code", open.error_code ?? "—"],
                  ["HTTP status", open.http_status ? String(open.http_status) : "—"],
                  ["VectorShift run id", open.vs_run_id ?? "—"],
                  ["Queued", fmtAt(open.queued_at)],
                  ["Started", fmtAt(open.started_at)],
                  ["Finished", fmtAt(open.finished_at)],
                  ["Duration", fmtMs(open.duration_ms)],
                  ["Sent", open.input_bytes ? fmtBytes(open.input_bytes) : "—"],
                  ["Received", open.output_bytes ? fmtBytes(open.output_bytes) : "—"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-all font-mono text-xs leading-5">{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        )}
      </div>
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} href={(p) => href({ page: String(p) })} />
    </div>
  );
}

function Select({ id, label, value, options }: { id: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-muted">{label}</label>
      <select id={id} name={id} defaultValue={value ?? ""} className="h-10 rounded-lg border border-line-2 bg-white px-2 text-sm capitalize">
        <option value="">Any</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
