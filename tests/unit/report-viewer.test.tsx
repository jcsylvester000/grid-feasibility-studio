/**
 * AC-030: every number in the payload appears in the rendered report, changed only by formatting.
 * Renders the product views server-side from the C6 golden payloads.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExecutiveSummaryView, FeasibilityReportView, QuickReportView } from "@/components/report/views";
import { formatFigure, formatMetric, peso, type Figure } from "@/lib/report/format";
import { samplePayload } from "@/lib/report/samples";

/* eslint-disable @typescript-eslint/no-explicit-any */
const isFigure = (v: any): v is Figure => v && typeof v === "object" && "unit" in v && "status" in v && ("value" in v || "range" in v);

function figures(o: any, out: Figure[] = []): Figure[] {
  if (Array.isArray(o)) o.forEach((x) => figures(x, out));
  else if (o && typeof o === "object") {
    if (isFigure(o)) out.push(o);
    else Object.values(o).forEach((x) => figures(x, out));
  }
  return out;
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

describe("report viewer (AC-030)", () => {
  it("Quick Report: every metric value and the indicative rating are shown", () => {
    const { payload: p } = samplePayload("quick_report") as { payload: any };
    const html = text(renderToStaticMarkup(<QuickReportView p={p} />));
    expect(html).toContain(p.indicative.label);
    expect(html).toContain(p.indicative.headline);
    for (const m of p.metrics) for (const v of [m.low, m.base, m.high]) expect(html).toContain(formatMetric(v, m.unit));
    for (const i of p.inputs) expect(html).toContain(i.value);
    for (const s of p.sources) expect(html).toContain(s.id);
  });

  it("Quick Report 1.1: the teaser check shows every claim, red flag and question", () => {
    const { payload: p } = samplePayload("quick_report_teaser") as { payload: any };
    const html = text(renderToStaticMarkup(<QuickReportView p={p} />));
    for (const c of p.listing_source.claims) expect(html).toContain(c.claim_text);
    for (const f of p.listing_source.red_flags) expect(html).toContain(f.flag);
    for (const q of p.listing_source.questions_for_seller) expect(html).toContain(q);
  });

  it("Executive Summary: verdict, all 11 items and every figure", () => {
    const { payload: p } = samplePayload("executive_summary") as { payload: any };
    const html = text(renderToStaticMarkup(<ExecutiveSummaryView p={p} />));
    expect(html).toContain(p.verdict.headline);
    for (const item of Object.values<any>(p.items)) expect(html).toContain(item.text);
    const figs = figures(p.key_figures);
    expect(figs.length).toBeGreaterThan(0);
    for (const f of figs) expect(html).toContain(formatFigure(f));
  });

  it("Feasibility Report: sections 1–13, criteria, returns and every statement value", () => {
    const { payload: p } = samplePayload("feasibility_report") as { payload: any };
    const html = text(renderToStaticMarkup(<FeasibilityReportView p={p} />));
    for (const s of Object.values<any>(p.sections)) expect(html).toContain(`${s.number}. ${s.title}`);
    for (const c of p.criteria) expect(html).toContain(c.name);
    const f = p.financials;
    for (const k of ["irr", "npv", "payback"]) if (f.returns?.[k]) expect(html).toContain(formatFigure(f.returns[k]));
    for (const st of [f.income_statement, f.cash_flow, f.balance_sheet].filter(Boolean))
      for (const l of st.lines) for (const v of l.values) if (v !== null) expect(html).toContain(peso(v).replace("₱", ""));
    const all = figures({ financials: f, sections: p.sections, es: p.front_matter.executive_summary.key_figures });
    for (const fig of all) expect(html).toContain(formatFigure(fig));
  });
});
