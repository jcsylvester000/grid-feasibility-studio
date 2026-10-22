import { Badge } from "@/components/ui/badge";
import { BASIS_LABELS, STATUS_LABELS, STATUS_TONES, asOf, formatFigure, type Figure } from "@/lib/report/format";
import { cn } from "@/lib/utils";

/** [S-001] style references that jump to the Sources list. */
export function SourceRefs({ ids }: { ids?: string[] | null }) {
  if (!ids?.length) return null;
  return (
    <span className="ml-1 whitespace-nowrap align-super text-[10px]">
      {ids.map((id, i) => (
        <a key={id} href={`#src-${id}`} className="font-mono no-underline hover:underline" aria-label={`Source ${id}`}>
          {i > 0 && ","}
          {id}
        </a>
      ))}
    </span>
  );
}

export function StatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} className={cn("text-[10px] print:border print:border-line", className)}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** A Figure: formatted value, price basis (asking prices are never shown as closed sales), date, status, sources. */
export function Fig({ f, compact = false }: { f: Figure; compact?: boolean }) {
  const basis = f.basis && BASIS_LABELS[f.basis];
  const date = asOf(f.as_of);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5" data-figure>
      <span className={cn("font-semibold tabular-nums", f.value === null && !f.range && "font-normal text-muted italic")}>{formatFigure(f)}</span>
      {basis && <span className="text-xs text-muted">({basis})</span>}
      {!compact && date && <span className="text-xs text-muted">as of {date}</span>}
      <SourceRefs ids={f.source_ids} />
    </span>
  );
}

export function SectionHeading({ id, number, title, right }: { id?: string; number?: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
      <h2 id={id} className="scroll-mt-24 text-2xl">
        {number && <span className="mr-2 text-bronze-ink">{number}.</span>}
        {title}
      </h2>
      {right}
    </div>
  );
}
