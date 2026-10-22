import { ArrowRight } from "lucide-react";
import { startReportAction } from "@/app/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/duration";
import { cn } from "@/lib/utils";

export type ProductCardData = {
  key: string;
  name: string;
  short: string;
  needs: string;
  typicalMs: number;
  typicalIsEstimate: boolean;
};

export function ProductCard({ p, highlighted = false, detailed = false }: { p: ProductCardData; highlighted?: boolean; detailed?: boolean }) {
  return (
    <form
      action={startReportAction}
      data-product={p.key}
      className={cn(
        "flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)] transition-shadow",
        highlighted && "ring-2 ring-bronze",
      )}
    >
      <input type="hidden" name="product" value={p.key} />
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl">{p.name}</h2>
        {highlighted && <Badge tone="brand">Suggested</Badge>}
      </div>
      <p className="mt-1.5 text-sm text-muted">{p.short}</p>
      {detailed && <p className="mt-3 text-sm text-ink-2"><span className="font-medium">Needs:</span> {p.needs}</p>}
      <p className="mt-3 text-xs text-muted">
        Typical time: <span className="font-medium text-ink">{formatDuration(p.typicalMs)}</span>
        {p.typicalIsEstimate && <span> (estimate)</span>}
      </p>
      <Button type="submit" className="mt-4 self-start" aria-label={`Start ${p.name}`}>
        Start <ArrowRight aria-hidden />
      </Button>
    </form>
  );
}
