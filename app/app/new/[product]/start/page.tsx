import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, FileText, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import type { Product } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { productInfo } from "@/lib/options/products";
import { isEnabledProduct } from "@/lib/reports/service";
import { canChain, carryOver, eligibleSources, REUSE_RESEARCH_DAYS, SOURCE_PRODUCTS } from "@/lib/reports/sources";
import { tokenCost } from "@/lib/tokens/config";
import { startFromSourceAction, startReportAction } from "../../../actions";

export const metadata: Metadata = { title: "Choose a starting point" };

const ERRORS: Record<string, string> = {
  NOT_FOUND: "That report could not be found. It may have been deleted.",
  NOT_A_SOURCE: "That report cannot be used for this product.",
  NO_RESULT: "That report has no finished version yet. Generate it first, or start blank.",
};

/** Choose a finished report to start from, or start blank (Executive Summary and Feasibility Report). */
export default async function StartFromPage({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<{ error?: string }> }) {
  const { product } = await params;
  const { error } = await searchParams;
  const { user } = await requireUser(`/app/new/${product}/start`);
  if (!isEnabledProduct(product) || !canChain(product)) notFound();
  const sources = await eligibleSources(user.id, product);
  if (!sources.length && !error) redirect(`/app/new/${product}`);
  const info = productInfo(product);
  const from = (SOURCE_PRODUCTS[product as Product] ?? []).map((p) => `${/^[AEIOU]/.test(productInfo(p).name) ? "an" : "a"} ${productInfo(p).name}`).join(" or ");
  const cost = tokenCost(product);

  return (
    <div className="max-w-3xl space-y-6" data-testid="start-from">
      <header>
        <p className="eyebrow">{info.name}</p>
        <h1 className="mt-2 text-3xl">Start from a report you have already run</h1>
        <p className="mt-2 text-muted">
          Pick {from}. Its answers carry over, and research less than {REUSE_RESEARCH_DAYS} days old is reused, so you only answer what is new. You can change anything before you generate.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">
          {ERRORS[error] ?? "That report could not be used. Choose another or start blank."}
        </p>
      )}
      <ul className="space-y-3">
        {sources.map((s) => {
          const carried = Object.keys(carryOver(s.product, s.intake, product as Product).intake).filter((k) => !k.startsWith("source.")).length;
          const days = s.ageDays;
          const fresh = s.reuse;
          return (
            <li key={s.id} className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]" data-testid="source-option" data-source-id={s.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow flex items-center gap-1.5"><FileText aria-hidden className="size-3.5" />{productInfo(s.product).name}</p>
                  <h2 className="mt-1 text-xl">{s.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    Latest version {formatDate(s.finishedAt)} · {s.versions} version{s.versions === 1 ? "" : "s"}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                    <li className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2.5 py-1 text-info">
                      <Sparkles aria-hidden className="size-3.5" />
                      {carried} answer{carried === 1 ? "" : "s"} carried over
                    </li>
                    <li className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${fresh ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
                      <RefreshCw aria-hidden className="size-3.5" />
                      {fresh ? `Research reused (${days === 0 ? "from today" : `${days} day${days === 1 ? "" : "s"} old`})` : `Research refreshed (${days} days old)`}
                    </li>
                  </ul>
                </div>
                <form action={startFromSourceAction} className="shrink-0">
                  <input type="hidden" name="product" value={product} />
                  <input type="hidden" name="source" value={s.id} />
                  <Button type="submit" aria-label={`Start ${info.name} from ${s.title}`}>
                    Start from this report <ArrowRight aria-hidden />
                  </Button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-line-2 bg-white p-5">
        <p className="text-sm text-muted">No suitable report? Start with an empty form instead.</p>
        <form action={startReportAction}>
          <input type="hidden" name="product" value={product} />
          <input type="hidden" name="blank" value="1" />
          <Button type="submit" variant="outline">Start blank</Button>
        </form>
      </div>
      {cost > 0 && <p className="text-xs text-muted">Generating a {info.name} uses {cost} GRID Tokens. You are asked before any tokens are used.</p>}
      <Link href="/app/new" className="text-sm">Back to choose a report</Link>
    </div>
  );
}
