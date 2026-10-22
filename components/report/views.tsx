/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Product layouts (BRD S-05): verdict or indicative rating first, key figures, sections, limitations,
 * sources with dates. Server components: no client JavaScript.
 */
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { formatFigure, formatMetric, peso, type Figure } from "@/lib/report/format";
import { cn } from "@/lib/utils";
import { Blocks } from "./blocks";
import { Claims, Disclaimer, Limitations, ReportSection, Sources, type SectionData } from "./parts";
import { Fig, SectionHeading, SourceRefs, StatusChip } from "./primitives";

// ------------------------------------------------------------------ shared

const RATING = {
  promising: { tone: "border-ok bg-ok-soft", text: "text-ok" },
  marginal: { tone: "border-warn bg-warn-soft", text: "text-warn" },
  weak: { tone: "border-bad bg-bad-soft", text: "text-bad" },
  cannot_tell: { tone: "border-na bg-na-soft", text: "text-na" },
  feasible: { tone: "border-ok bg-ok-soft", text: "text-ok" },
  conditionally_feasible: { tone: "border-warn bg-warn-soft", text: "text-warn" },
  not_feasible: { tone: "border-bad bg-bad-soft", text: "text-bad" },
  insufficient_data: { tone: "border-na bg-na-soft", text: "text-na" },
} as const;

const VERDICT_LABEL: Record<string, string> = {
  feasible: "Feasible",
  conditionally_feasible: "Conditionally feasible",
  not_feasible: "Not feasible",
  insufficient_data: "Insufficient data",
};

function Banner({ rating, label, headline, confidence, children }: { rating: string; label: string; headline: string; confidence: string; children?: React.ReactNode }) {
  const r = RATING[rating as keyof typeof RATING] ?? RATING.cannot_tell;
  return (
    <section aria-label="Result" className={cn("rounded-[var(--radius-card)] border-l-4 p-5 sm:p-6 print:break-inside-avoid", r.tone)} data-testid="verdict">
      <div className="flex flex-wrap items-center gap-3">
        <p className={cn("font-display text-3xl", r.text)}>{label}</p>
        <Badge tone="neutral">{confidence} confidence</Badge>
      </div>
      <p className="mt-2 text-lg leading-snug text-ink">{headline}</p>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------ Quick Report

const TAG_LABEL: Record<string, string> = { can: "Broker can provide", idea: "Broker has an idea", cant: "Usually can't provide", system: "Studio setting" };
const FLAG_TONE = { warning: "warning", info: "info", risk: "risk" } as const;

function PricePosition({ m }: { m: any }) {
  if (!m?.compare || m.base === null) return null;
  const lo = Math.min(m.compare.low, m.base);
  const hi = Math.max(m.compare.high, m.base);
  const span = hi - lo || 1;
  const P = (v: number) => `${((v - lo) / span) * 84 + 8}%`;
  return (
    <figure className="rounded-xl border border-line bg-white p-5 print:break-inside-avoid" data-testid="price-position">
      <figcaption className="font-medium">Where the asking price sits</figcaption>
      <div className="relative mt-10 mb-8 h-3 rounded-full bg-sand" aria-hidden>
        <div className="absolute inset-y-0 rounded-full bg-gold/60" style={{ left: P(m.compare.low), right: `calc(100% - ${P(m.compare.high)})` }} />
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-navy shadow" style={{ left: P(m.base) }} />
        <span className="absolute -top-7 -translate-x-1/2 whitespace-nowrap text-xs font-semibold" style={{ left: P(m.base) }}>
          Asking {formatMetric(m.base, m.unit)}
        </span>
        <span className="absolute top-5 -translate-x-1/2 whitespace-nowrap text-xs text-muted" style={{ left: P(m.compare.low) }}>
          {formatMetric(m.compare.low, m.unit)}
        </span>
        <span className="absolute top-5 -translate-x-1/2 whitespace-nowrap text-xs text-muted" style={{ left: P(m.compare.high) }}>
          {formatMetric(m.compare.high, m.unit)}
        </span>
      </div>
      <p className="text-xs text-muted">Shaded band: comparable listings (asking prices, not closed sales). Dot: this property&apos;s asking price.</p>
      <p className="sr-only">
        Asking {formatMetric(m.base, m.unit)}; comparable listings {formatMetric(m.compare.low, m.unit)} to {formatMetric(m.compare.high, m.unit)}.
      </p>
    </figure>
  );
}

export function QuickReportView({ p }: { p: any }) {
  const priceMetric = p.metrics.find((m: any) => m.compare);
  return (
    <div className="space-y-10">
      <Banner rating={p.indicative.rating} label={p.indicative.label} headline={p.indicative.headline} confidence={p.indicative.confidence}>
        <p className="mt-3 text-xs text-muted">Indicative price screen, not a feasibility verdict. {p.screening_rule?.note}</p>
      </Banner>

      <PricePosition m={priceMetric} />

      <section aria-labelledby="qr-metrics" className="space-y-3">
        <SectionHeading id="qr-metrics" title="Key figures" />
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[560px] text-left text-sm" data-testid="metrics">
            <thead className="bg-sand text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Figure</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Low</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Base</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">High</th>
              </tr>
            </thead>
            <tbody>
              {p.metrics.map((m: any) => (
                <tr key={m.key} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium">{m.label}</span> <StatusChip status={m.status} />
                    <span className="mt-0.5 block text-xs text-muted">{m.formula}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMetric(m.low, m.unit)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMetric(m.base, m.unit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMetric(m.high, m.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {p.flags?.length > 0 && (
        <section aria-labelledby="qr-flags" className="space-y-3">
          <SectionHeading id="qr-flags" title="Flags" />
          <Blocks blocks={p.flags.map((f: any) => ({ type: "callout", tone: FLAG_TONE[f.tone as keyof typeof FLAG_TONE] ?? "info", text: f.label }))} />
        </section>
      )}

      {p.listing_source && <TeaserCheck ls={p.listing_source} />}

      <section aria-labelledby="qr-inputs" className="space-y-3">
        <SectionHeading id="qr-inputs" title="What this screen used" />
        <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
          {p.inputs.map((i: any) => (
            <li key={i.key} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[200px_1fr_auto] sm:gap-4">
              <span className="text-muted">{i.label}</span>
              <span>{i.value}</span>
              <span className="flex flex-wrap gap-1 sm:justify-end">
                <Badge tone="brand" className="text-[10px]">{TAG_LABEL[i.provider_tag] ?? i.provider_tag}</Badge>
                <StatusChip status={i.status} />
              </span>
            </li>
          ))}
        </ul>
        {p.notes?.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {p.notes.map((n: string, i: number) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      {(p.estimates_next?.length > 0 || p.upgrade_path?.length > 0) && (
        <section aria-labelledby="qr-next" className="space-y-3">
          <SectionHeading id="qr-next" title="Next steps for a fuller picture" />
          {p.estimates_next?.length > 0 && <NextList title="1. Broker estimates to add" items={p.estimates_next} />}
          {p.upgrade_path?.length > 0 && <NextList title={`${p.estimates_next?.length ? "2" : "1"}. From the owner or offices (upgrade to the full Feasibility Report)`} items={p.upgrade_path} />}
        </section>
      )}

      <Limitations items={p.limitations} />
      <Sources sources={p.sources} />
      <Disclaimer meta={p.meta} />
    </div>
  );
}

function NextList({ title, items }: { title: string; items: any[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
        {items.map((u) => (
          <li key={u.key} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[1fr_220px]">
            <span>
              {u.label}
              {u.why && <span className="block text-xs text-muted">{u.why}</span>}
            </span>
            <span className="text-muted sm:text-right">{u.who_provides}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ Teaser check (Quick Report 1.1 listing_source)

const CLAIM_STATUS: Record<string, { label: string; tone: "ok" | "bad" | "warn" | "neutral" }> = {
  consistent: { label: "Consistent", tone: "ok" },
  contradicted: { label: "Contradicted", tone: "bad" },
  partly_consistent: { label: "Partly consistent", tone: "warn" },
  unverified: { label: "Needs document", tone: "warn" },
  not_checked: { label: "Not checked", tone: "neutral" },
};
const SEVERITY_TONE = { high: "bad", medium: "warn", low: "neutral" } as const;

export function TeaserCheck({ ls }: { ls: any }) {
  return (
    <section aria-labelledby="teaser-check" className="space-y-4" data-testid="teaser-check">
      <SectionHeading id="teaser-check" title="Teaser check" right={<span className="text-xs text-muted">{ls.files_count} file(s) · {String(ls.relationship).replace(/_/g, " ")}</span>} />
      {ls.claims?.length > 0 && (
        <ul className="space-y-2 text-sm">
          {ls.claims.map((c: any) => {
            const st = CLAIM_STATUS[c.status] ?? CLAIM_STATUS.not_checked!;
            return (
              <li key={c.id} className="rounded-lg border border-line bg-white p-3 print:break-inside-avoid">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">&ldquo;{c.claim_text}&rdquo;</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="mt-1 text-ink-2">
                  {c.finding}
                  <SourceRefs ids={c.source_ids} />
                </p>
                <p className="mt-1 text-xs text-muted">Next step: {c.next_step}</p>
              </li>
            );
          })}
        </ul>
      )}
      {ls.red_flags?.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Red flags</p>
          <ul className="space-y-2 text-sm">
            {ls.red_flags.map((f: any, i: number) => (
              <li key={i} className="flex gap-3 rounded-lg border border-line bg-white p-3">
                <Badge tone={SEVERITY_TONE[f.severity as keyof typeof SEVERITY_TONE] ?? "neutral"}>{f.severity}</Badge>
                <span>
                  <span className="font-medium">{f.flag}.</span> {f.why}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {ls.questions_for_seller?.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Questions for the seller</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {ls.questions_for_seller.map((q: string, i: number) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ Executive Summary

const ES_ITEMS: [string, string][] = [
  ["project_description", "Project description"],
  ["company_developer", "Company or developer"],
  ["goals_objectives", "Goals and objectives"],
  ["location_analysis", "Location"],
  ["market_analysis", "Market"],
  ["technical_study", "Technical study"],
  ["socio_economic", "Socio-economic"],
  ["environmental", "Environmental"],
  ["financial_projection", "Financial projection"],
  ["findings_recommendation", "Findings and recommendation"],
  ["conclusion", "Conclusion"],
];

export function ExecutiveSummaryView({ p, embedded = false }: { p: any; embedded?: boolean }) {
  const v = p.verdict;
  return (
    <div className="space-y-8" data-testid={embedded ? "embedded-summary" : undefined}>
      <Banner rating={v.rating} label={VERDICT_LABEL[v.rating] ?? v.rating} headline={v.headline} confidence={v.confidence}>
        {v.conditions?.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {v.conditions.map((c: string, i: number) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
        {v.thesis_breaker && (
          <p className="mt-3 text-sm">
            <span className="font-medium">What would change this: </span>
            {v.thesis_breaker}
          </p>
        )}
        {v.confidence_note && <p className="mt-2 text-xs text-muted">{v.confidence_note}</p>}
      </Banner>

      {p.key_figures && <Blocks blocks={[p.key_figures]} />}

      <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {ES_ITEMS.map(([key, label]) => {
          const item = p.items[key];
          if (!item) return null;
          return (
            <div key={key} className="print:break-inside-avoid">
              <dt className="flex items-center gap-2 font-display text-lg">
                {label}
                {item.coverage !== "complete" && <Badge tone="warn" className="font-sans text-[10px]">{String(item.coverage).replace("_", " ")}</Badge>}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-2">
                {item.text}
                {item.claim_ids?.length > 0 && (
                  <span className="ml-1 align-super text-[10px]">
                    {item.claim_ids.map((id: string) => (
                      <a key={id} href={`#claim-${id}`} className="mr-1 font-mono no-underline">
                        {id}
                      </a>
                    ))}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby={`${embedded ? "e-" : ""}risks`} className="space-y-2">
          <h3 id={`${embedded ? "e-" : ""}risks`} className="text-xl">Key risks</h3>
          <ul className="space-y-2 text-sm">
            {p.key_risks.map((r: any, i: number) => (
              <li key={i} className="rounded-lg border border-line bg-white p-3">
                <div className="flex gap-2">
                  <Badge tone={SEVERITY_TONE[r.severity as keyof typeof SEVERITY_TONE] ?? "neutral"}>{r.severity}</Badge>
                  <span className="font-medium">{r.risk}</span>
                </div>
                {r.mitigation && <p className="mt-1 text-xs text-muted">Mitigation: {r.mitigation}</p>}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby={`${embedded ? "e-" : ""}next`} className="space-y-2">
          <h3 id={`${embedded ? "e-" : ""}next`} className="text-xl">Next steps</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {p.next_steps.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      </div>

      {!embedded && (
        <>
          <Limitations items={p.limitations} title="Scope and limits" />
          <Claims claims={p.claims} />
          <Sources sources={p.sources} />
          <Disclaimer meta={p.meta} />
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Feasibility Report

const SECTION_ORDER = [
  "introduction",
  "project_description",
  "feasibility_criteria",
  "marketing_plan",
  "technical_study",
  "socio_economic_political",
  "environmental",
  "organizational_management",
  "risk_sensitivity",
  "methodology_limitations",
  "findings_recommendations",
  "conclusion",
  "annex",
];

function Criteria({ items }: { items: any[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white" data-testid="criteria">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-sand text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Criterion</th>
            <th scope="col" className="px-3 py-2 font-medium">Threshold</th>
            <th scope="col" className="px-3 py-2 font-medium">Result</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Weight</th>
            <th scope="col" className="px-3 py-2 font-medium">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="border-t border-line align-top">
              <td className="px-3 py-2">
                <span className="mr-1 font-mono text-xs text-bronze-ink">{c.id}</span>
                {c.name}
                {c.is_gate && <Badge tone="brand" className="ml-1 text-[10px]">Gate</Badge>}
              </td>
              <td className="px-3 py-2 text-ink-2">{c.threshold}</td>
              <td className="px-3 py-2 text-ink-2">{c.result ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{Math.round((c.weight ?? 0) * 100)}%</td>
              <td className="px-3 py-2">
                {c.passed === true ? <Badge tone="ok">Pass</Badge> : c.passed === false ? <Badge tone="bad">Fail</Badge> : <Badge tone="warn">Not yet judged</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Statement({ title, s }: { title: string; s: any }) {
  if (!s) {
    return (
      <div className="rounded-xl border border-dashed border-warn/50 bg-warn-soft/50 p-4 text-sm">
        <p className="font-medium text-warn">{title}: inputs required</p>
        <p className="text-ink-2">The owner&apos;s cost and funding figures are needed for this statement.</p>
      </div>
    );
  }
  const scale = s.scale ?? "one";
  return (
    <figure className="print:break-inside-avoid">
      <figcaption className="mb-2 font-medium">
        {title} <span className="text-xs font-normal text-muted">({s.currency}{scale !== "one" ? `, ${scale}s` : ""})</span>
      </figcaption>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-right text-xs tabular-nums">
          <thead className="bg-sand text-muted">
            <tr>
              <th scope="col" className="sticky left-0 bg-sand px-3 py-2 text-left font-medium">Line</th>
              {s.periods.map((p: string) => (
                <th key={p} scope="col" className="px-3 py-2 font-medium">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l: any) => (
              <tr key={l.key} className={cn("border-t border-line", l.is_total && "font-semibold")}>
                <th scope="row" className="sticky left-0 min-w-44 bg-white px-3 py-1.5 text-left font-normal print:min-w-32">{l.label}</th>
                {l.values.map((v: number | null, i: number) => (
                  <td key={i} className="whitespace-nowrap px-3 py-1.5">{v === null ? "—" : peso(v).replace("₱", "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Financials({ f }: { f: any }) {
  const returns = f.returns ?? {};
  const RET: [string, string][] = [["irr", "Project IRR"], ["npv", "NPV"], ["payback", "Payback"], ["equity_multiple", "Equity multiple"], ["discount_rate", "Discount rate"]];
  return (
    <section aria-labelledby="sec-financials" className="space-y-5" data-testid="financials">
      <SectionHeading id="sec-financials" title="Financial study" right={<span className="text-xs text-muted">Computed by GRID&apos;s financial engine, not by a language model</span>} />
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {RET.filter(([k]) => returns[k]).map(([k, label]) => (
          <div key={k} className="rounded-xl border border-line bg-white p-3">
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1">
              <Fig f={returns[k] as Figure} compact />
            </dd>
          </div>
        ))}
      </dl>

      {f.scenarios?.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="px-3 pt-3 text-left font-medium">Scenarios</caption>
            <thead className="text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Scenario</th>
                <th scope="col" className="px-3 py-2 font-medium">Changes</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">IRR</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">NPV</th>
              </tr>
            </thead>
            <tbody>
              {f.scenarios.map((s: any) => (
                <tr key={s.name} className="border-t border-line">
                  <td className="px-3 py-2 font-medium capitalize">{s.name}</td>
                  <td className="px-3 py-2 text-ink-2">{s.changes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.irr ? formatFigure(s.irr) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.npv ? formatFigure(s.npv) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {f.capital_requirement && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-white p-4 text-sm">
            <p className="font-medium">
              Capital required: <Fig f={f.capital_requirement.total} compact />
            </p>
            <ul className="mt-2 space-y-1">
              {f.capital_requirement.uses?.map((u: any) => (
                <li key={u.label} className="flex justify-between gap-3">
                  <span className="text-muted">{u.label}</span>
                  <Fig f={u.figure} compact />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-white p-4 text-sm">
            <p className="font-medium">Funding</p>
            <ul className="mt-2 space-y-1">
              {f.capital_requirement.sources_of_funds?.map((u: any) => (
                <li key={u.label} className="flex justify-between gap-3">
                  <span className="text-muted">{u.label}</span>
                  <Fig f={u.figure} compact />
                </li>
              ))}
            </ul>
            {f.capital_requirement.strategy && <p className="mt-2 text-xs text-muted">{f.capital_requirement.strategy}</p>}
          </div>
        </div>
      )}

      {f.break_even && (
        <p className="text-sm">
          <span className="font-medium">Break-even: </span>
          {[f.break_even.units_or_sqm, f.break_even.revenue, f.break_even.period].filter(Boolean).map((x: Figure) => formatFigure(x)).join(" · ")}
        </p>
      )}

      {f.assumptions?.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="px-3 pt-3 text-left font-medium">Assumptions</caption>
            <tbody>
              {f.assumptions.map((a: any) => (
                <tr key={a.key} className="border-t border-line align-top">
                  <th scope="row" className="px-3 py-2 font-normal text-muted">{a.label}</th>
                  <td className="px-3 py-2">
                    <Fig f={a.figure} compact /> <StatusChip status={a.figure.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{a.basis_note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Statement title="Income statement" s={f.income_statement} />
      <Statement title="Cash flow" s={f.cash_flow} />
      <Statement title="Balance sheet" s={f.balance_sheet} />
    </section>
  );
}

export function FeasibilityReportView({ p }: { p: any }) {
  const fm = p.front_matter;
  const sections = SECTION_ORDER.map((k) => p.sections[k]).filter(Boolean) as SectionData[];
  const toc = (
    <nav aria-labelledby="toc" className="rounded-[var(--radius-card)] border border-line bg-white p-5 print:break-after-page">
      <h2 id="toc" className="text-xl">Contents</h2>
      <ol className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        <li><a href="#summary">Executive summary</a></li>
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#sec-${s.id}`}>
              {s.number}. {s.title}
            </a>
          </li>
        ))}
        {p.financials && <li><a href="#sec-financials">Financial study</a></li>}
        <li><a href="#sources">Annex A: Sources</a></li>
        {p.claims?.length > 0 && <li><a href="#claims">Annex B: Claims checked</a></li>}
      </ol>
    </nav>
  );
  const summary = (
    <section aria-labelledby="summary" className="space-y-4 print:break-after-page">
      <SectionHeading id="summary" title="Executive summary" />
      <ExecutiveSummaryView p={fm.executive_summary} embedded />
    </section>
  );

  return (
    <div className="space-y-10">
      <header className="rounded-[var(--radius-card)] bg-navy p-6 text-white sm:p-8 print:break-after-page print:bg-white print:text-ink">
        <p className="eyebrow !text-gold print:!text-bronze-ink">Feasibility Report</p>
        <h2 className="mt-2 text-3xl sm:text-4xl">{fm.cover.title}</h2>
        <p className="mt-2 text-mist print:text-muted">{fm.cover.subtitle}</p>
        <p className="mt-4 text-sm text-mist print:text-muted">
          {formatDate(fm.cover.date)}
          {p.meta.prepared_for ? ` · Prepared for ${p.meta.prepared_for}` : ""}
        </p>
      </header>

      {fm.toc_mode === "toc_first" ? (
        <>
          {toc}
          {summary}
        </>
      ) : (
        <>
          {summary}
          {toc}
        </>
      )}

      {sections.map((s) => (
        <div key={s.id} className="space-y-6">
          {s.id === "annex" ? (
            <section aria-labelledby="sec-annex" className="space-y-6">
              <ReportSection s={s} />
              <Sources sources={p.sources} title="Annex A: Sources" />
              <Claims claims={p.claims} />
            </section>
          ) : (
            <ReportSection s={s} />
          )}
          {s.id === "feasibility_criteria" && p.criteria?.length > 0 && <Criteria items={p.criteria} />}
          {s.id === "organizational_management" && p.financials && <Financials f={p.financials} />}
          {s.id === "methodology_limitations" && <Limitations items={p.limitations} title="Limitations" />}
        </div>
      ))}
      <Disclaimer meta={p.meta} />
    </div>
  );
}

