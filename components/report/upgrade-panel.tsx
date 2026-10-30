/** "Take this further": start an Executive Summary or Feasibility Report from this finished report. */
import { ArrowUpRight } from "lucide-react";
import { startFromSourceAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/db/schema";
import { productInfo } from "@/lib/options/products";
import { isEnabledProduct } from "@/lib/reports/service";
import { SOURCE_PRODUCTS } from "@/lib/reports/sources";

export function upgradeTargets(product: string): Product[] {
  return (Object.entries(SOURCE_PRODUCTS) as [Product, Product[]][]).filter(([to, from]) => from.includes(product as Product) && isEnabledProduct(to)).map(([to]) => to);
}

export function UpgradePanel({ reportId, product }: { reportId: string; product: string }) {
  const targets = upgradeTargets(product);
  if (!targets.length) return null;
  const name = productInfo(product as Product).name;
  return (
    <section data-print="hide" aria-labelledby="upgrade-title" className="rounded-[var(--radius-card)] border border-bronze/40 bg-bronze-soft/40 p-5" data-testid="upgrade-panel">
      <h2 id="upgrade-title" className="text-lg">Take this further</h2>
      <p className="mt-1 text-sm text-ink-2">
        Start a fuller report from this {name}. Its answers carry over and its research is reused if it is less than 30 days old, so you only add what is new.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {targets.map((to) => (
          <form key={to} action={startFromSourceAction}>
            <input type="hidden" name="product" value={to} />
            <input type="hidden" name="source" value={reportId} />
            <Button type="submit" variant={to === targets[0] ? "primary" : "outline"} data-testid={`upgrade-${to}`}>
              Upgrade to {productInfo(to).name} <ArrowUpRight aria-hidden />
            </Button>
          </form>
        ))}
      </div>
    </section>
  );
}
