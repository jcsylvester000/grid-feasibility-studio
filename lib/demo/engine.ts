/**
 * Demo stand-in pipeline: runs GRID's prototype engine (lib/demo/prototype-src.ts) in a sandbox to build a
 * Quick Report, Executive Summary or Feasibility Report payload from the user's own answers. Used by the mock
 * VectorShift server and the demo scenarios until the real VectorShift pipelines are connected.
 * Every figure comes from the inputs; research steps are not connected, and the payload says so ("Prototype").
 */
import vm from "node:vm";
import { PROTOTYPE_SOURCES } from "./prototype-src";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Engine = { E: any; Q: any };
let cached: Engine | null = null;

function engine(): Engine {
  if (cached) return cached;
  const ctx: Record<string, unknown> = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const [name, code] of PROTOTYPE_SOURCES) vm.runInContext(code, ctx, { filename: name });
  cached = { E: ctx.FS_ENGINE, Q: ctx.FS_QUICK };
  return cached;
}

/** { "property.city": "Taguig", "qd.lot_area": 15000 } → { property: { city: "Taguig" }, qd: { lot_area: 15000 } } */
export function unflatten(flat: Record<string, unknown>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split(".");
    let cur = out;
    for (const p of parts.slice(0, -1)) cur = cur[p] = cur[p] && typeof cur[p] === "object" ? cur[p] : {};
    cur[parts.at(-1)!] = v;
  }
  return out;
}

const deepMerge = (base: any, over: any): any => {
  if (!over || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = base && typeof base[k] === "object" && !Array.isArray(base[k]) ? deepMerge(base[k], v) : v;
  return out;
};

export type DemoProduct = "quick_report" | "executive_summary" | "feasibility_report";

/**
 * A payload for one product from flat intake keys (the app's field-dictionary keys). docs.* keys mark
 * documents as provided. `sample` adds the prototype's "Contains SAMPLE data" line to the disclaimer.
 */
export function prototypePayload(product: DemoProduct, flat: Record<string, unknown>, opts: { reportId?: string; sample?: boolean; now?: Date } = {}) {
  const { E, Q } = engine();
  const nested = unflatten(flat);
  const docs = Object.fromEntries(Object.entries(nested.docs ?? {}).map(([k, v]) => [k, !!v]));
  const intake = deepMerge(E.blankIntake(), { ...nested, docs, product, sample: !!opts.sample });
  if (intake.fin && flat["fin.enabled"] !== true) intake.fin.enabled = false;
  if (product === "quick_report") intake.qd = deepMerge(Q.blank(), nested.qd ?? {});
  const now = opts.now ?? new Date();
  const out = product === "quick_report" ? Q.generate(intake, now) : E.generate(intake, now);
  const doc = JSON.parse(JSON.stringify(out.doc)) as Record<string, any>;
  if (opts.reportId) doc.meta.report_id = opts.reportId;
  // Make the stand-in visible in every report: the pipeline that will replace it is not connected yet.
  doc.meta.disclaimer = `${PROTOTYPE_NOTE} ${doc.meta.disclaimer ?? ""}`.trim();
  return doc;
}

export const PROTOTYPE_NOTE =
  "PROTOTYPE: produced by GRID's stand-in pipeline from the inputs entered, not by the live VectorShift research pipelines. Figures and wording are illustrative until the live pipelines are connected.";
