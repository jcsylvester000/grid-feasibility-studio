/** Small server components shared by the admin pages. */
import Link from "next/link";
import { RANGES, type RangeKey } from "@/lib/admin/service";
import type { Period } from "@/lib/db/repos/admin";
import { cn } from "@/lib/utils";

export const fmtInt = (n: number) => new Intl.NumberFormat("en-PH").format(n);
export const fmtPct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
export const fmtMs = (n: number | null) =>
  n === null ? "—" : n >= 60_000 ? `${(n / 60_000).toFixed(1)} min` : n >= 1000 ? `${Math.round(n / 1000)} s` : `${Math.round(n)} ms`;
export function fmtBytes(n: number) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
/** Asia/Manila date and time, e.g. "22 Oct 2026, 14:05". */
export function fmtAt(d: Date | string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));
}

const LABEL: Record<string, string> = { today: "Today", "7d": "7 days", "30d": "30 days", "90d": "90 days" };

export function PeriodPicker({ current, period, base, extra = {} }: { current: RangeKey; period: Period; base: string; extra?: Record<string, string> }) {
  const q = (o: Record<string, string>) => `${base}?${new URLSearchParams({ ...extra, ...o }).toString()}`;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="period-picker">
      <ul className="flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => (
          <li key={k}>
            <Link
              href={q({ range: k })}
              aria-current={current === k ? "true" : undefined}
              className={cn("inline-block rounded-md px-3 py-1.5 text-sm no-underline", current === k ? "bg-navy text-white" : "text-ink-2 hover:bg-sand")}
            >
              {LABEL[k]}
            </Link>
          </li>
        ))}
      </ul>
      <form action={base} className="flex flex-wrap items-center gap-1 text-sm">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="range" value="custom" />
        <label className="sr-only" htmlFor="from">From</label>
        <input id="from" name="from" type="date" defaultValue={period.from} className="h-9 rounded-lg border border-line-2 bg-white px-2" />
        <span aria-hidden>–</span>
        <label className="sr-only" htmlFor="to">To</label>
        <input id="to" name="to" type="date" defaultValue={period.to} className="h-9 rounded-lg border border-line-2 bg-white px-2" />
        <button type="submit" className="h-9 rounded-lg border border-line-2 bg-white px-3 hover:border-bronze">Apply</button>
      </form>
    </div>
  );
}

export function Tile({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4" data-testid={testId}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line-2 bg-white p-6 text-center text-sm text-muted">{children}</p>;
}

export function Pager({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between text-sm">
      <span className="text-muted">
        Page {page} of {pages} · {fmtInt(total)} total
      </span>
      <span className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
        {page < pages && <Link href={href(page + 1)}>Next</Link>}
      </span>
    </nav>
  );
}
