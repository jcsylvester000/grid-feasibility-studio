/**
 * Quick Report from GRID's live VectorShift pipeline (output format vs_quick_report/1). Server component.
 * The rating and key figures are computed by code from the answers entered (lib/report/quick-screen.ts);
 * the pipeline supplies the research: summary, checks, market snapshot and sources. Everything from the
 * pipeline is shown as text (React escapes it); source links are https/http only.
 */
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { quickScreen, SCREEN_LABEL, SCREEN_RULE } from "@/lib/report/quick-screen";
import type { LabelledInput } from "@/lib/reports/inputs";
import type { QuickReportLive } from "@/lib/vectorshift/quick-report-live";
import { Blocks } from "./blocks";
import { SectionHeading } from "./primitives";
import { Banner, PricePosition } from "./views";

const clean = (s: string) => s.replace(/[​-‍﻿]/g, "");

const TONE: Record<string, string> = { warning: "warning", warn: "warning", info: "info", ok: "success", success: "success", risk: "risk", error: "risk", bad: "risk" };

/** Pipeline checks that repeat one the app already makes from the answers (same topic). */
const TOPICS: [RegExp, string][] = [
  [/zonal/i, "app_zonal"],
  [/title/i, "app_no_title"],
  [/tax.?dec/i, "app_no_tax_dec"],
  [/asking.*closed|closed.*sale/i, "app_asking"],
];

/** Text with [n] citations turned into links to the numbered sources. */
function Cited({ text, known }: { text: string; known: Set<number> }) {
  const parts = clean(text).split(/(\[\d{1,3}\])/);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d{1,3})\]$/);
        const n = m ? Number(m[1]) : 0;
        return m && known.has(n) ? (
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

function CiteLinks({ cites, known }: { cites: number[]; known: Set<number> }) {
  const ok = cites.filter((c) => known.has(c));
  if (!ok.length) return null;
  return (
    <sup className="ml-0.5">
      {ok.map((c) => (
        <a key={c} href={`#src-${c}`} className="no-underline">[{c}]</a>
      ))}
    </sup>
  );
}

/** Minimal Markdown for pipeline text: paragraphs, "-"/"*"/"1." bullets, **bold**, "#" headings. */
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
    const bullet = line.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) { list.push(bullet[1]!); continue; }
    flush();
    const h = line.match(/^#{1,6}\s+(.*)$/);
    blocks.push(h ? <p key={`h${blocks.length}`} className="font-semibold"><Bold text={h[1]!} /></p> : <p key={`p${blocks.length}`}><Bold text={line} /></p>);
  }
  flush();
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}

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
  const screen = quickScreen(intake);
  const known = new Set(r.sources.map((s) => s.n));
  const disagrees = r.rating.rating !== screen.rating;
  const covered = new Set(screen.checks.map((c) => c.key));
  const pipelineChecks = r.checks.filter((c) => !TOPICS.some(([re, key]) => covered.has(key) && re.test(`${c.key} ${c.detail}`)));
  const checks = [...screen.checks.map((c) => ({ tone: c.tone, text: c.detail })), ...pipelineChecks.map((c) => ({ tone: TONE[c.tone.toLowerCase()] ?? (c.ok === false ? "warning" : "info"), text: clean(c.detail) }))];
  const summary = r.summary;
  // The pipeline's own headline names its rating; hide it when that differs from the rating shown.
  const otherRating = (["promising", "marginal", "weak"] as const).filter((x) => x !== screen.rating).some((x) => new RegExp(`\\b${x}\\b`, "i").test(summary?.headline ?? ""));
  const summaryHeadline = summary && !otherRating ? summary.headline : "";

  return (
    <div className="space-y-10" data-testid="live-quick-report">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone="ok">Live research</Badge>
        Market research by GRID&apos;s Quick Report pipeline on VectorShift{reportRef ? ` · Ref ${reportRef}` : ""}
      </p>

      <Banner rating={screen.rating} label={screen.label} headline={screen.headline} confidence={r.rating.confidence}>
        {(r.rating.evidenceScore !== null || r.rating.evidenceText) && (
          <p className="mt-3 text-sm text-ink-2">
            <span className="font-medium">Evidence{r.rating.evidenceScore !== null ? ` ${r.rating.evidenceScore}/5` : ""}:</span> {clean(r.rating.evidenceText)}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">{SCREEN_RULE}</p>
        {disagrees && (
          <p className="mt-2 text-xs text-muted" data-print="hide" data-testid="rating-note">
            The research pipeline suggested &ldquo;{SCREEN_LABEL[r.rating.rating]}&rdquo;; the rating above follows GRID&apos;s screening rule applied to the
            answers entered.
          </p>
        )}
      </Banner>

      {screen.price && <PricePosition m={screen.price} />}

      {screen.figures.length > 0 && (
        <section aria-labelledby="lqr-metrics" className="space-y-3">
          <SectionHeading id="lqr-metrics" title="Key figures" />
          <div tabIndex={0} className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[420px] text-left text-sm" data-testid="live-metrics">
              <tbody>
                {screen.figures.map((f) => (
                  <tr key={f.key} className="border-t border-line align-top first:border-t-0">
                    <th scope="row" className="px-3 py-2 font-normal">
                      <span className="font-medium">{f.label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{f.formula}</span>
                    </th>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">{f.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Computed by GRID from the answers entered. Comparables are asking prices, not closed sales.</p>
        </section>
      )}

      {summary && (summaryHeadline || summary.notes.length > 0) && (
        <section aria-labelledby="lqr-summary" className="space-y-3">
          <SectionHeading id="lqr-summary" title="Summary" />
          <div className="space-y-3 rounded-xl border border-line bg-white p-5 text-sm leading-relaxed" data-testid="live-summary">
            {summaryHeadline && <p className="font-medium text-ink">{clean(summaryHeadline)}</p>}
            {summary.notes.length > 0 && (
              <ul className="list-disc space-y-1.5 pl-5">
                {summary.notes.map((n, i) => (
                  <li key={i}><Cited text={n} known={known} /></li>
                ))}
              </ul>
            )}
            {summary.truncated && (
              <p className="text-xs text-muted" data-print="hide">The research pipeline&apos;s summary was cut off; only its complete notes are shown.</p>
            )}
          </div>
        </section>
      )}

      {checks.length > 0 && (
        <section aria-labelledby="lqr-checks" className="space-y-3">
          <SectionHeading id="lqr-checks" title="Checks" />
          <Blocks blocks={checks.map((c) => ({ type: "callout", tone: c.tone, text: c.text }))} />
        </section>
      )}

      {r.snapshot.length > 0 && (
        <section aria-labelledby="lqr-snapshot" className="space-y-4">
          <SectionHeading id="lqr-snapshot" title="Market snapshot" right={r.snapshotDate ? <span className="text-xs text-muted">As of {clean(r.snapshotDate)}</span> : undefined} />
          {r.snapshot.map((q) => (
            <article key={q.id} className="rounded-xl border border-line bg-white p-5 print:break-inside-avoid">
              <h3 className="font-medium">{clean(q.title)}</h3>
              {q.answer && <p className="mt-2 text-sm leading-relaxed"><Cited text={q.answer} known={known} /></p>}
              {q.evidence.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                  {q.evidence.map((e, i) => (
                    <li key={i} className="border-l-2 border-gold/70 pl-3">
                      <Cited text={e.text} known={known} />
                      <CiteLinks cites={e.cites} known={known} />
                      {e.source && <span className="mt-0.5 block text-xs text-muted">{clean(e.source)}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {q.bullets.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {q.bullets.map((b, i) => (
                    <li key={i}><Cited text={b} known={known} /></li>
                  ))}
                </ul>
              )}
              {q.facts.length > 0 && (
                <dl className="mt-3 grid gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm sm:grid-cols-[220px_1fr]">
                  {q.facts.map((f, i) => (
                    <Fragment key={i}>
                      <dt className="text-muted">{f.label}</dt>
                      <dd className="min-w-0 break-words"><Cited text={f.value} known={known} /></dd>
                    </Fragment>
                  ))}
                </dl>
              )}
            </article>
          ))}
          <p className="text-xs text-muted">Public listings show asking prices, not closed sales. Check the sources before relying on a figure.</p>
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

      {r.sources.length > 0 && (
        <section aria-labelledby="lqr-sources" className="space-y-3">
          <SectionHeading id="lqr-sources" title="Sources" />
          <ol className="space-y-1.5 text-sm" data-testid="live-sources">
            {r.sources.map((s) => (
              <li key={s.n} id={`src-${s.n}`} className="grid grid-cols-[2.5rem_1fr] gap-1">
                <span className="font-mono text-xs text-bronze-ink">[{s.n}]</span>
                <span className="min-w-0 break-all">
                  {s.label && <span className="mr-1 break-words">{clean(s.label)}</span>}
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                      {s.url}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {r.qa && (
        <details className="rounded-xl border border-line bg-white p-5" data-print="hide">
          <summary className="cursor-pointer font-medium">Quality check notes from the pipeline (GRID)</summary>
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
