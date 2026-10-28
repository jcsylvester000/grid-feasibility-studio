/**
 * Mock of GRID's live Quick Report pipeline (named text inputs → result_envelope in the pipeline's own format).
 * Figures are computed from the inputs; the market snapshot says plainly that no research was run.
 */
const n = (s: unknown) => {
  const m = String(s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

export function isLiveQuickReportRequest(inputs: Record<string, unknown>) {
  return inputs.run_request === undefined && typeof inputs.asking_price_per_sqm === "string";
}

export function liveQuickReportOutputs(inputs: Record<string, string>) {
  const ask = n(inputs.asking_price_per_sqm);
  const low = n(inputs.comparable_lowest);
  const high = n(inputs.comparable_highest);
  const area = n(inputs.lot_area);
  const commissionPct = n(inputs.commission) ?? 0;
  const zonal = /not checked/i.test(inputs.bir_zonal_value ?? "") ? null : n(inputs.bir_zonal_value);
  const ok = ask !== null && low !== null && high !== null && high >= low;
  const mid = ok ? (low! + high!) / 2 : null;
  const rating = !ok ? "cannot_tell" : ask! < low! ? "promising" : ask! > high! ? "weak" : "marginal";
  const label = { promising: "Promising - worth a full study", marginal: "Marginal - fairly priced", weak: "Weak - priced above the market", cannot_tell: "Can't tell yet" }[rating];
  const fmt = (v: number) => `PHP ${new Intl.NumberFormat("en-PH").format(Math.round(v))}`;
  const headline = !ok
    ? "Not enough to screen yet: add the asking price and the comparable range."
    : rating === "marginal"
      ? `Marginal: asked at ${fmt(ask!)}/sqm, inside the comparable range of ${fmt(low!)} to ${fmt(high!)}.`
      : rating === "promising"
        ? `Promising: asked at ${fmt(ask!)}/sqm, below the lowest comparable (${fmt(low!)}).`
        : `Weak: asked at ${fmt(ask!)}/sqm, above the highest comparable (${fmt(high!)}).`;
  const total = ok && area ? ask! * area : null;
  const metrics: Record<string, number> = {};
  if (total !== null) {
    metrics.total_asking_price_php = total;
    metrics.comparable_low_total_php = low! * area!;
    metrics.comparable_high_total_php = high! * area!;
    metrics.asking_price_vs_comparable_low_pct = ((ask! - low!) / low!) * 100;
    metrics.asking_price_vs_comparable_high_pct = ((ask! - high!) / high!) * 100;
    metrics.asking_price_vs_comparable_midpoint_pct = ((ask! - mid!) / mid!) * 100;
    metrics.commission_php = (total * commissionPct) / 100;
  }
  const checks = [
    ...(zonal === null ? [{ key: "zonal_not_checked", ok: false, tone: "warning", detail: "BIR zonal value not checked yet. It is public and quick to look up." }] : []),
    ...(/no copy/i.test(inputs.title_copy ?? "") ? [{ key: "no_title", ok: false, tone: "warning", detail: "No title copy yet. Ask the seller for a photocopy, then get a certified true copy." }] : []),
    { key: "mock", ok: true, tone: "info", detail: "Mock pipeline: no market research was run. Figures come only from the answers entered." },
  ];
  const result = {
    quick_report_inputs: inputs,
    market_snapshot: {
      q1: {
        question: `What public comparable listings were found in ${inputs.city_municipality || "this city"}?`,
        answer: "Mock pipeline: no listings were searched. The live pipeline answers this with dated public listings and citations [1].",
        broker_figure: ok ? `Broker comparables: ${fmt(low!)}-${fmt(high!)}/sqm from ${inputs.comparable_count || "an unknown number of"} listings.` : "",
      },
    },
    sources: ["https://www.bir.gov.ph/zonal-values"],
    checks,
    metrics,
    rating: {
      rating,
      label,
      headline,
      confidence: ok ? "medium" : "low",
      evidence_score: ok ? 3 : 1,
      evidence_text: [inputs.comparable_count, inputs.comparables_gathered].filter(Boolean).join(", "),
      rule: { note: "Below the comparable low = Promising; inside the range = Marginal; above the comparable high = Weak." },
    },
    draft: "",
    qa_result: "Mock QA: not run.",
  };
  return {
    result_envelope: JSON.stringify(result),
    Q01_tag_and_range_cost: "0",
    Q06_one_page_writer_cost: "0",
    Q07_qa_cost: "0",
    Q08__Publish_cost: "0",
  };
}
