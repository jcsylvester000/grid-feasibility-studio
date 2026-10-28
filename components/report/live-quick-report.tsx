/**
 * Quick Report from GRID's live VectorShift pipeline (output format vs_quick_report/1). Server component.
 * Everything the pipeline returned is shown as text (React escapes it); source links are https only.
 */
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { num, peso } from "@/lib/report/format";
import type { LabelledInput } from "@/lib/reports/inputs";
import type { QuickReportLive } from "@/lib/vectorshift/quick-report-live";
import { Blocks } from "./blocks";
import { SectionHeading } from "./primitives";
import { Banner, PricePosition } from "./views";

const METRIC_LABEL: Record<string, string> = {
  total_asking_price_php: "Total asking price",
  comparable_low_total_php: "Value at the lowest comparable",
  comparable_high_total_php: "Value at the highest comparable",
  asking_price_vs_comparable_low_pct: "Asking price against the lowest comparable",
  asking_price_vs_comparable_high_pct: "Asking price against the highest comparable",
  asking_price_vs_comparable_midpoint_pct: "Asking price against the middle of the range",
  commission_php: "Commission",
};

const clean = (s: string) => s.replace(/[​-‍﻿]/g, "");
export const humanize = (key: string) => {
  const t = clean(key).replace(/_(php|pct)$/i, "").replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function formatLiveMetric(key: string, v: number) {
  if (/_pct$/i.test(key)) return `${v > 0 ? "+" : ""}${num(v, 1)}%`;
  if (/_php$/i.test(key)) return peso(v);
  return num(v, 2);
}

const TONE: Record<string, string> = { warning: "warning", warn: "warning", info: "info", ok: "success", success: "success", risk: "risk", error: "risk", bad: "risk" };

/** Text with [n] citations turned into links to the numbered sources. */
function Cited({ text, sources }: { text: string; sources: number }) {
  const parts = clean(text).split(/(\[\d{1,3}\])/);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d{1,3})\]$/);
        const n = m ? Number(m[1]) : 0;
        return m && n >= 1 && n <= sources ? (
          <sup key={i}>
            <a href={`#src-${n}`} className="no-underline">[{n}]</a>
          </sup>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        );
      })}
    </>
  );
}

/** Minimal Markdown for pipeline text: paragraphs, "-"/"*" bullets, **bold**, "#" headings. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {clean(text)
        .split(/(\*\*[^*]+\*\*)/)
        .map((t, i) => (t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <strong key={i}>{t.slice(2, -2)}</strong> : <Fragment key={i}>{t}</Fragment>))}
    </>
  );
}

export function SimpleMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      blocks.push(
        <ul key={`l${blocks.length}`} className="list-disc space-y-1 pl-5">
          {list.map((l, i) => (
            <li key={i}><Bold text={l} /></li>
          ))}
        </ul>,
      );
    list = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) { list.push(bullet[1]!); continue; }
    flush();
    const h = line.match(/^#{1,6}\s+(.*)$/);
    blocks.push(h ? <p key={`h${blocks.length}`} className="font-semibold"><Bold text={h[1]!} /></p> : <p key={`p${blocks.length}`}><Bold text={line} /></p>);
  }
  flush();
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}

const safeUrl = (u: string) => (/^https?:\/\/[^\s"<>]+$/i.test(u.trim()) ? u.trim() : null);

export function LiveQuickReportView({
  r,
  intake,
  inputs,
  reportRef,
}: {
  r: QuickReportLive;
  intake: Record<string, unknown>;
  inputs: LabelledInput[];
  reportRef: string | null;
}) {
  const ask = Number(intake["qd.ask_psqm"]);
  const low = Number(intake["qd.comp_low"]);
  const high = Number(intake["qd.comp_high"]);
  const price = [ask, low, high].every((v) => Number.isFinite(v) && v > 0) ? { base: ask, unit: "PHP/sqm", compare: { low, high } } : null;
  const nSources = r.sources.length;
  // Stored JSON does not keep key order: known figures first, in a fixed order, then any others.
  const order = Object.keys(METRIC_LABEL);
  const rank = (k: string) => (order.indexOf(k) === -1 ? order.length : order.indexOf(k));
  const metrics = [...r.metrics].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));

  return (
    <div className="space-y-10" data-testid="live-quick-report">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone="ok">Live research</Badge>
        Produced by GRID&apos;s Quick Report pipeline on VectorShift{reportRef ? ` · Ref ${reportRef}` : ""}
      </p>

      <Banner rating={r.rating.rating} label={r.rating.label} headline={r.rating.headline} confidence={r.rating.confidence}>
        {(r.rating.evidenceScore !== null || r.rating.evidenceText) && (
          <p className="mt-3 text-sm text-ink-2">
            <span className="font-medium">Evidence{r.rating.evidenceScore !== null ? ` ${r.rating.evidenceScore}/5` : ""}:</span> {r.rating.evidenceText}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">Indicative price screen, not a feasibility verdict. {r.rating.ruleNote}</p>
      </Banner>

      {price && <PricePosition m={price} />}

      {metrics.length > 0 && (
        <section aria-labelledby="lqr-metrics" className="space-y-3">
          <SectionHeading id="lqr-metrics" title="Key figures" />
          <div tabIndex={0} className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[420px] text-left text-sm" data-testid="live-metrics">
              <tbody>
                {metrics.map(([k, v]) => (
                  <tr key={k} className="border-t border-line first:border-t-0">
                    <th scope="row" className="px-3 py-2 font-medium">{METRIC_LABEL[k] ?? humanize(k)}</th>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatLiveMetric(k, v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Computed from the answers entered: asking prices, not closed sales.</p>
        </section>
      )}

      {r.checks.length > 0 && (
        <section aria-labelledby="lqr-checks" className="space-y-3">
          <SectionHeading id="lqr-checks" title="Checks" />
          <Blocks blocks={r.checks.map((c) => ({ type: "callout", tone: TONE[c.tone.toLowerCase()] ?? (c.ok === false ? "warning" : "info"), text: c.detail }))} />
        </section>
      )}

      {r.snapshot.length > 0 && (
        <section aria-labelledby="lqr-snapshot" className="space-y-4">
          <SectionHeading id="lqr-snapshot" title="Market snapshot" />
          {r.snapshot.map((q) => (
            <article key={q.id} className="rounded-xl border border-line bg-white p-5 print:break-inside-avoid">
              {q.question && <h3 className="font-medium">{clean(q.question)}</h3>}
              {q.answer && <p className="mt-2 text-sm leading-relaxed"><Cited text={q.answer} sources={nSources} /></p>}
              {q.extra.length > 0 && (
                <dl className="mt-3 grid gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm sm:grid-cols-[220px_1fr]">
                  {q.extra.map(([k, v]) => (
                    <Fragment key={k}>
                      <dt className="text-muted">{humanize(k)}</dt>
                      <dd className="min-w-0 break-words"><Cited text={v} sources={nSources} /></dd>
                    </Fragment>
                  ))}
                </dl>
              )}
            </article>
          ))}
        </section>
      )}

      {r.draft && (
        <section aria-labelledby="lqr-summary" className="space-y-3">
          <SectionHeading id="lqr-summary" title="Summary" />
          <div className="rounded-xl border border-line bg-white p-5"><SimpleMarkdown text={r.draft} /></div>
        </section>
      )}

      <section aria-labelledby="lqr-inputs" className="space-y-3">
        <SectionHeading id="lqr-inputs" title="What this screen used" />
        <dl className="divide-y divide-line rounded-xl border border-line bg-white text-sm" data-testid="version-inputs">
          {inputs.map((i) => (
            <div key={i.key} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[220px_1fr] sm:gap-4">
              <dt className="text-muted">{i.label}</dt>
              <dd>{i.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {nSources > 0 && (
        <section aria-labelledby="lqr-sources" className="space-y-3">
          <SectionHeading id="lqr-sources" title="Sources" />
          <ol className="space-y-1.5 text-sm" data-testid="live-sources">
            {r.sources.map((s, i) => {
              const url = safeUrl(s);
              return (
                <li key={i} id={`src-${i + 1}`} className="grid grid-cols-[2.5rem_1fr] gap-1">
                  <span className="font-mono text-xs text-bronze-ink">[{i + 1}]</span>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 break-all">{url}</a>
                  ) : (
                    <span className="min-w-0 break-words">{s}</span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted">Listing and third-party sources show asking prices and public figures; check them before relying on them.</p>
        </section>
      )}

      {r.qa && (
        <details className="rounded-xl border border-line bg-white p-5" data-print="hide">
          <summary className="cursor-pointer font-medium">Quality check notes (GRID)</summary>
          <div className="mt-3"><SimpleMarkdown text={r.qa} /></div>
        </details>
      )}

      <footer className="border-t border-line pt-4 text-xs text-muted">
        Prepared by GRID Property Ventures · Feasibility Studio. Desk research to inform decisions: not a licensed appraisal, or engineering, legal, tax or
        financial advice. Comparable figures are asking prices, not closed sales; the BIR zonal value is a tax basis, not market value.
      </footer>
    </div>
  );
}
