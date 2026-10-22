/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge } from "@/components/ui/badge";
import { COVERAGE_LABELS } from "@/lib/report/format";
import { formatDate } from "@/lib/format";
import { Blocks, type Block } from "./blocks";
import { SectionHeading, SourceRefs, StatusChip } from "./primitives";

const COVERAGE_TONE = { complete: "ok", partial: "warn", light: "warn", inputs_required: "warn", out_of_scope: "neutral" } as const;

export type SectionData = {
  id: string;
  number?: string;
  title: string;
  coverage: keyof typeof COVERAGE_TONE;
  owner: string;
  summary?: string;
  blocks: Block[];
  subsections?: SectionData[];
};

export function ReportSection({ s, level = 2 }: { s: SectionData; level?: 2 | 3 }) {
  const badge = s.coverage !== "complete" && (
    <Badge tone={COVERAGE_TONE[s.coverage] ?? "neutral"}>{COVERAGE_LABELS[s.coverage] ?? s.coverage}</Badge>
  );
  return (
    <section aria-labelledby={`sec-${s.id}`} className="space-y-4 print:break-inside-auto">
      {level === 2 ? (
        <SectionHeading id={`sec-${s.id}`} number={s.number} title={s.title} right={badge} />
      ) : (
        <h3 id={`sec-${s.id}`} className="scroll-mt-24 text-xl">
          {s.number && <span className="mr-2 text-bronze-ink">{s.number}</span>}
          {s.title} {badge}
        </h3>
      )}
      {s.summary && <p className="font-medium text-ink">{s.summary}</p>}
      {s.coverage === "out_of_scope" && s.blocks.length === 0 ? (
        <p className="text-sm text-muted">Out of scope for this report.</p>
      ) : (
        <Blocks blocks={s.blocks} />
      )}
      {s.subsections?.map((sub) => <ReportSection key={sub.id} s={sub} level={3} />)}
    </section>
  );
}

export type Source = {
  id: string;
  title: string;
  publisher: string;
  url?: string | null;
  type: string;
  tier: string;
  published_on?: string | null;
  accessed_on: string;
  url_status: string;
};

export function Sources({ sources, title = "Sources" }: { sources: Source[]; title?: string }) {
  if (!sources?.length) return null;
  return (
    <section aria-labelledby="sources" className="space-y-3">
      <SectionHeading id="sources" title={title} />
      <ol className="space-y-2 text-sm">
        {sources.map((s) => (
          <li key={s.id} id={`src-${s.id}`} className="scroll-mt-24 rounded-lg target:bg-gold/20">
            <span className="mr-2 font-mono text-xs text-bronze-ink">{s.id}</span>
            {s.url && s.url_status !== "dead" ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-ink">
                {s.title}
              </a>
            ) : (
              <span>{s.title}</span>
            )}
            <span className="text-muted">
              {" "}
              · {s.publisher}
              {s.published_on ? ` · published ${formatDate(s.published_on.slice(0, 10))}` : ""} · accessed {formatDate(s.accessed_on.slice(0, 10))} · tier {s.tier}
              {s.url_status === "paywalled" ? " · paywalled" : s.url_status === "dead" ? " · link no longer works" : ""}
            </span>
            {s.url && <span className="hidden break-all text-xs text-muted print:block">{s.url}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Claims({ claims }: { claims: any[] }) {
  if (!claims?.length) return null;
  return (
    <section aria-labelledby="claims" className="space-y-3">
      <SectionHeading id="claims" title="Claims checked" />
      <ul className="space-y-2 text-sm">
        {claims.map((c) => (
          <li key={c.id} id={`claim-${c.id}`} className="grid gap-1 rounded-lg border border-line bg-white p-3 sm:grid-cols-[auto_1fr_auto] sm:gap-3">
            <span className="font-mono text-xs text-bronze-ink">{c.id}</span>
            <span>
              {c.text}
              <SourceRefs ids={c.source_ids} />
              {c.conflict && <span className="mt-1 block text-xs text-warn">Conflict: {c.conflict}</span>}
            </span>
            <span className="flex flex-wrap items-start gap-1 sm:justify-end">
              <StatusChip status={c.status} />
              <Badge tone="neutral" className="text-[10px]">{c.confidence} confidence</Badge>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const EFFECT: Record<string, string> = {
  section_omitted: "Section left out",
  section_partial: "Section partly covered",
  figures_estimated: "Figures estimated",
  verdict_capped: "Verdict capped",
  confidence_reduced: "Lower confidence",
};

export function Limitations({ items, title = "Limitations" }: { items: any[]; title?: string }) {
  return (
    <section aria-labelledby="limitations" className="space-y-3">
      <SectionHeading id="limitations" title={title} />
      {!items?.length ? (
        <p className="text-sm text-muted">No limitations were recorded.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((l) => (
            <li key={l.id} className="rounded-lg border border-line bg-white p-3 print:break-inside-avoid">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-bronze-ink">{l.id}</span>
                <Badge tone="warn" className="text-[10px]">{EFFECT[l.effect] ?? l.effect}</Badge>
              </div>
              <p className="mt-1">{l.reason}</p>
              {l.missing_inputs?.length > 0 && <p className="mt-1 text-xs text-muted">Missing: {l.missing_inputs.join(", ")}</p>}
              {l.how_to_resolve && <p className="mt-1 text-xs text-muted">How to resolve: {l.how_to_resolve}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Disclaimer({ meta }: { meta: any }) {
  return (
    <footer className="space-y-1 border-t border-line pt-4 text-xs text-muted">
      {meta?.disclaimer && <p>{meta.disclaimer}</p>}
      <p>
        {meta?.prepared_by ? `Prepared by ${meta.prepared_by}. ` : ""}
        {meta?.as_of ? `Data as of ${formatDate(String(meta.as_of).slice(0, 10))}. ` : ""}
        {meta?.run?.dag_id ? `Pipeline ${meta.run.dag_id} ${meta.run.dag_version ?? ""}.` : ""}
      </p>
      <p>Not a licensed appraisal, or engineering, legal, tax or financial advice.</p>
    </footer>
  );
}
