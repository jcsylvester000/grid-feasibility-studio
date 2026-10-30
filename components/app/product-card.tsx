import { ArrowRight, Coins } from "lucide-react";
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
  /** GRID Tokens this product uses per report (absent or 0: not charged). */
  tokenCost?: number;
  /** The user's balance, when the product is charged. */
  tokenBalance?: number;
};

export function ProductCard({ p, highlighted = false, detailed = false }: { p: ProductCardData; highlighted?: boolean; detailed?: boolean }) {
  const cost = p.tokenCost ?? 0;
  const blocked = cost > 0 && (p.tokenBalance ?? 0) < cost;
  const noteId = `tokens-${p.key}`;
  return (
    <form
      action={startReportAction}
      data-product={p.key}
      data-blocked={blocked || undefined}
      className={cn(
        "flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)] transition-shadow",
        highlighted && !blocked && "ring-2 ring-bronze",
        blocked && "bg-sand/60 shadow-none",
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
      {cost > 0 && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted" data-testid="product-token-cost">
          <Coins aria-hidden className="size-3.5 text-bronze-ink" />
          Uses <span className="font-medium text-ink">{cost} GRID {cost === 1 ? "Token" : "Tokens"}</span> per report
        </p>
      )}
      {blocked && (
        <p id={noteId} className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-xs text-ink">
          <span className="font-semibold text-bad">Not enough GRID Tokens.</span> You have {p.tokenBalance}; this report uses {cost}.
        </p>
      )}
      <Button
        type="submit"
        className="mt-4 self-start"
        aria-label={`Start ${p.name}`}
        disabled={blocked}
        aria-describedby={blocked ? noteId : undefined}
      >
        Start <ArrowRight aria-hidden />
      </Button>
    </form>
  );
}
