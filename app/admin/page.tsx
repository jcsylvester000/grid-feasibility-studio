import type { Metadata } from "next";
import Link from "next/link";
import { Empty, fmtAt, fmtBytes, fmtInt, fmtMs, fmtPct, PeriodPicker, Tile } from "@/components/admin/ui";
import { SvgChart } from "@/components/report/chart";
import { periodFrom } from "@/lib/admin/service";
import { topUsers, usageSeries, usageSummary } from "@/lib/db/repos/admin";
import { PRODUCTS as PRODUCT_LIST } from "@/lib/options/products";

const PRODUCT_NAMES: Record<string, string> = Object.fromEntries(PRODUCT_LIST.map((p) => [p.key, p.name]));

export const metadata: Metadata = { title: "Usage overview" };

type Search = Promise<{ range?: string; from?: string; to?: string }>;

const days = (from: string, to: string) => {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};
const short = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** AD-01 Usage overview. All figures from the admin views (PV-01); Asia/Manila days. */
export default async function AdminOverview({ searchParams }: { searchParams: Search }) {
  const { key, period } = periodFrom(await searchParams);
  const [s, series, top] = await Promise.all([usageSummary(period), usageSeries(period), topUsers(period)]);
  const x = days(period.from, period.to);
  const products = [...new Set(series.runs.map((r) => r.product ?? "unknown"))];
  const runsByProduct = products.map((p) => ({
    name: p === "unknown" ? "Unknown" : (PRODUCT_NAMES[p] ?? p),
    values: x.map((d) => series.runs.filter((r) => r.d === d && (r.product ?? "unknown") === p).reduce((a, r) => a + r.n, 0)),
  }));
  const active = [{ name: "Active users", values: x.map((d) => series.active.find((a) => a.d === d)?.n ?? 0) }];
  const noData = s.runs === 0 && s.activeUsers === 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Usage overview</h1>
          <p className="mt-1 text-sm text-muted">
            {short(period.from)} to {short(period.to)} · Asia/Manila · people shown by User ID only
          </p>
        </div>
        <PeriodPicker current={key} period={period} base="/admin" />
      </header>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Registered users" value={fmtInt(s.registered)} testId="tile-registered" />
        <Tile label="Active users" value={fmtInt(s.activeUsers)} testId="tile-active" />
        <Tile label="Runs" value={fmtInt(s.runs)} testId="tile-runs" />
        <Tile label="Success rate" value={fmtPct(s.successRate)} hint="Succeeded ÷ finished" testId="tile-success" />
        <Tile label="Median run time" value={fmtMs(s.medianMs)} testId="tile-median" />
        <Tile label="Storage" value={fmtBytes(s.storageBytes)} hint={`${fmtInt(s.storageFiles)} files`} testId="tile-storage" />
      </section>

      {noData ? (
        <Empty>No activity in this period.</Empty>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
            <section className="rounded-xl border border-line bg-white p-4" aria-labelledby="c-runs">
              <h2 id="c-runs" className="mb-2 font-sans text-sm font-semibold">Runs per day by product</h2>
              <SvgChart chartType="stacked_bar" title="Runs per day by product" x={{ label: "Day", values: x.map(short) }} series={runsByProduct} />
            </section>
            <section className="rounded-xl border border-line bg-white p-4" aria-labelledby="c-active">
              <h2 id="c-active" className="mb-2 font-sans text-sm font-semibold">Active users per day</h2>
              <SvgChart chartType="line" title="Active users per day" x={{ label: "Day", values: x.map(short) }} series={active} />
            </section>
          </div>
          <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
            <section className="rounded-xl border border-line bg-white p-4" aria-labelledby="c-fail">
              <h2 id="c-fail" className="mb-2 font-sans text-sm font-semibold">Failures by code</h2>
              {series.failures.length ? (
                <SvgChart chartType="bar" title="Failures by code" x={{ label: "Code", values: series.failures.map((f) => f.code ?? "UNKNOWN") }} series={[{ name: "Failures", values: series.failures.map((f) => f.n) }]} />
              ) : (
                <p className="text-sm text-muted">No failed runs in this period.</p>
              )}
            </section>
            <section className="rounded-xl border border-line bg-white p-4" aria-labelledby="t-top">
              <h2 id="t-top" className="mb-2 font-sans text-sm font-semibold">Most active User IDs</h2>
              <table className="w-full text-left text-sm" data-testid="top-users">
                <thead className="text-muted">
                  <tr>
                    <th scope="col" className="py-1.5 font-medium">User ID</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Runs</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((u) => (
                    <tr key={u.user_public_id} className="border-t border-line">
                      <td className="py-1.5 font-mono">
                        <Link href={`/admin/users/${u.user_public_id}`}>{u.user_public_id}</Link>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{fmtInt(u.runs)}</td>
                      <td className="py-1.5 text-right">{fmtAt(u.last_active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
