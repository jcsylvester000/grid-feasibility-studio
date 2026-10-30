/**
 * Report chaining: start an Executive Summary or a Feasibility Report from a report the user has already
 * run, so the answers (and, in the pipeline, the research) carry over and the user only answers what is new.
 *   Quick Report → Executive Summary;  Executive Summary or Quick Report → Feasibility Report.
 * The link and the carried-over values live in the new report's intake under "source.*" keys.
 */
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { createDraftReport, getReportForUser } from "@/lib/db/repos/reports";
import { reports, runs, type Product } from "@/lib/db/schema";
import type { UserRow } from "@/lib/db/repos/users";
import { DEFAULT_INTAKE } from "@/lib/forms";
import { productInfo } from "@/lib/options/products";
import { formatDate } from "@/lib/format";
import { track } from "@/lib/usage/track";
import { sourceAge } from "./source-age";

/** Which finished reports can feed which product. */
export const SOURCE_PRODUCTS: Partial<Record<Product, Product[]>> = {
  executive_summary: ["quick_report"],
  feasibility_report: ["executive_summary", "quick_report"],
};

export { REUSE_RESEARCH_DAYS } from "./source-age";

export const canChain = (product: string): product is Product => !!SOURCE_PRODUCTS[product as Product];
export const isSourceFor = (target: string, source: string) => !!SOURCE_PRODUCTS[target as Product]?.includes(source as Product);

export type SourceReport = {
  id: string;
  product: Product;
  title: string;
  finishedAt: Date;
  versions: number;
  intake: Record<string, unknown>;
  /** Days since the latest version finished, and whether its research would be reused. */
  ageDays: number;
  reuse: boolean;
};

/** The user's finished reports that can feed `product`, newest first. */
export async function eligibleSources(userId: string, product: Product, limit = 20): Promise<SourceReport[]> {
  const from = SOURCE_PRODUCTS[product];
  if (!from?.length) return [];
  const db = await getDb();
  const finished = max(runs.finishedAt);
  const rows = await db
    .select({ id: reports.id, product: reports.product, title: reports.title, intake: reports.intake, finishedAt: finished, versions: count(runs.id) })
    .from(reports)
    .innerJoin(runs, and(eq(runs.reportId, reports.id), eq(runs.status, "succeeded")))
    .where(and(eq(reports.userId, userId), inArray(reports.product, from)))
    .groupBy(reports.id)
    .orderBy(desc(finished))
    .limit(limit);
  const now = new Date();
  return rows
    .filter((r): r is typeof r & { finishedAt: Date } => !!r.finishedAt)
    .map((r) => {
      const age = sourceAge({ "source.finished_at": r.finishedAt.toISOString() }, now)!;
      return { ...r, versions: Number(r.versions), ageDays: age.days, reuse: age.reuse };
    });
}

/** Latest succeeded run of a report (the version an upgrade starts from). */
async function latestSucceeded(reportId: string) {
  const db = await getDb();
  const [r] = await db
    .select({ id: runs.id, finishedAt: runs.finishedAt })
    .from(runs)
    .where(and(eq(runs.reportId, reportId), eq(runs.status, "succeeded")))
    .orderBy(desc(runs.finishedAt))
    .limit(1);
  return r?.finishedAt ? { id: r.id, finishedAt: r.finishedAt } : null;
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
const filled = (v: unknown) => v !== undefined && v !== null && v !== "";

/** Keys shared by the Executive Summary and Feasibility Report forms (copied as they are). */
const SHARED_KEYS = [
  "property.name", "property.region", "property.province", "property.city", "property.road_access", "property.lot_area", "property.floor_area",
  "use.intended_use", "use.detail", "use.goal", "use.horizon", "use.target_irr",
  "market.asking_low", "market.asking_high", "market.comps_count", "market.as_of", "market.zonal_per_sqm",
  "owner.name", "owner.type", "owner.track", "owner.years",
  "fin.land_cost", "fin.build_cost", "fin.price_per_sqm", "fin.rent_per_sqm_month",
  "zoning_answer", "hazard_answer",
];

/**
 * Answers carried from the source report into the new product's form, and which of them are approximate
 * (Quick Report dropdowns are bands such as "about 15,000 sqm"). The user can replace approximate values
 * with exact ones; nothing else needs re-entering.
 */
export function carryOver(from: Product, intake: Record<string, unknown>, to: Product) {
  const out: Record<string, unknown> = {};
  const approx: Record<string, number> = {};
  const put = (key: string, v: unknown, approximate = false) => {
    if (!filled(v)) return;
    out[key] = v;
    const n = num(v);
    if (approximate && n !== null) approx[key] = n;
  };

  if (from === "quick_report") {
    for (const k of ["property.region", "property.province", "property.city", "property.road_access", "use.goal", "owner.type"]) put(k, intake[k]);
    const lot = num(intake["qd.lot_area"]);
    const ask = num(intake["qd.ask_psqm"]);
    put("property.lot_area", lot, true);
    const floor = num(intake["qd.floor_area"]);
    if (floor && floor > 0) put("property.floor_area", floor, true);
    put("market.asking_low", num(intake["qd.comp_low"]), true);
    put("market.asking_high", num(intake["qd.comp_high"]), true);
    const comps = num(intake["qd.comp_count"]);
    if (comps && comps > 0) put("market.comps_count", comps, true);
    const zonal = num(intake["qd.zonal"]);
    if (zonal && zonal > 0) put("market.zonal_per_sqm", zonal, true);
    // Land cost suggestion: the asking price for the whole lot. The user confirms or replaces it.
    if (lot && ask) put("fin.land_cost", lot * ask, true);
    if (ask) out["source.asking_price_per_sqm"] = ask;
  } else {
    for (const k of SHARED_KEYS) put(k, intake[k]);
    // Values that were approximate in the source and were never replaced stay approximate.
    const prior = (intake["source.approx"] ?? {}) as Record<string, number>;
    for (const [k, v] of Object.entries(prior)) if (num(out[k]) === v) approx[k] = v;
    if (to === "feasibility_report" && num(out["fin.land_cost"])) out["fin.enabled"] = true;
  }
  return { intake: out, approx };
}

export type SourceInfo = {
  reportId: string;
  product: Product;
  productName: string;
  title: string;
  finishedOn: string;
  ageDays: number;
  reuse: boolean;
  carried: number;
  approx: Record<string, number>;
  exists: boolean;
};

/** The source link recorded on a report, for the form banner and hints; null when started blank. */
export async function sourceInfo(userId: string, intake: Record<string, unknown>, now = new Date()): Promise<SourceInfo | null> {
  const id = intake["source.report_id"];
  const product = intake["source.product"];
  if (typeof id !== "string" || typeof product !== "string") return null;
  const age = sourceAge(intake, now);
  const still = await getReportForUser(userId, id);
  return {
    reportId: id,
    product: product as Product,
    productName: productInfo(product as Product).name,
    title: typeof intake["source.title"] === "string" ? (intake["source.title"] as string) : productInfo(product as Product).name,
    finishedOn: age ? formatDate(age.finishedAt) : "",
    ageDays: age?.days ?? 0,
    reuse: age?.reuse ?? false,
    carried: typeof intake["source.carried"] === "number" ? (intake["source.carried"] as number) : 0,
    approx: (intake["source.approx"] ?? {}) as Record<string, number>,
    exists: !!still,
  };
}

export type ChainResult = { ok: true; reportId: string } | { ok: false; status: number; code: string; message: string };

/** Create a draft of `product` from the user's finished `sourceId`, with the answers carried over. */
export async function createFromSource(user: UserRow, product: Product, sourceId: string): Promise<ChainResult> {
  const source = await getReportForUser(user.id, sourceId);
  if (!source) return { ok: false, status: 404, code: "NOT_FOUND", message: "Report not found" };
  if (!isSourceFor(product, source.product))
    return { ok: false, status: 400, code: "NOT_A_SOURCE", message: `A ${productInfo(source.product).name} cannot be used to start a ${productInfo(product).name}.` };
  const version = await latestSucceeded(source.id);
  if (!version) return { ok: false, status: 409, code: "NO_RESULT", message: "That report has no finished version yet." };

  const { intake: carried, approx } = carryOver(source.product, source.intake, product);
  const city = typeof carried["property.city"] === "string" ? (carried["property.city"] as string) : null;
  const intake = {
    ...(DEFAULT_INTAKE[product] ?? {}),
    ...carried,
    "source.report_id": source.id,
    "source.product": source.product,
    "source.run_id": version.id,
    "source.finished_at": version.finishedAt.toISOString(),
    "source.title": source.title,
    "source.carried": Object.keys(carried).filter((k) => !k.startsWith("source.")).length,
    "source.approx": approx,
  };
  const title = `${productInfo(product).name} · ${city ?? source.title} (from ${productInfo(source.product).name})`.slice(0, 120);
  const report = await createDraftReport(user.id, product, title, intake);
  await track(user.publicId, "report.created", { product, status: `from_${source.product}` });
  return { ok: true, reportId: report.id };
}
