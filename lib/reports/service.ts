/** Report rules shared by route handlers and Server Actions (BRD S-01, S-02, S-06, section 13). */
import { z } from "zod";
import { PRODUCTS, isProductEnabled, productInfo } from "@/lib/options/products";
import { isTeaserScanEnabled } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import {
  createDraftReport,
  deleteReportForUser,
  typicalDurations,
  updateReport,
} from "@/lib/db/repos/reports";
import { PRODUCTS as PRODUCT_KEYS, REPORT_STATUSES, type Product } from "@/lib/db/schema";
import type { UserRow } from "@/lib/db/repos/users";
import { track } from "@/lib/usage/track";

export const MIN_RUNS_FOR_TYPICAL = 20;
export const MAX_INTAKE_BYTES = 200_000;

export const productSchema = z.enum(PRODUCT_KEYS);
export const statusSchema = z.enum(REPORT_STATUSES);

export function enabledProducts() {
  const teaser = isTeaserScanEnabled();
  return PRODUCTS.filter((p) => isProductEnabled(p, teaser));
}

export function isEnabledProduct(product: string): product is Product {
  return enabledProducts().some((p) => p.key === product);
}

/** Products with their typical time: measured median after 20 runs, otherwise the GRID estimate. */
export async function productsWithTypicalTimes() {
  const list = enabledProducts();
  let measured: Awaited<ReturnType<typeof typicalDurations>> = {};
  try {
    measured = await typicalDurations(list.map((p) => p.key));
  } catch (err) {
    console.error("typicalDurations failed:", err instanceof Error ? err.message : err);
  }
  return list.map((p) => {
    const m = measured[p.key];
    const useMeasured = !!m && m.n >= MIN_RUNS_FOR_TYPICAL;
    return { ...p, typicalMs: useMeasured ? m!.medianMs : p.estimateMs, typicalIsEstimate: !useMeasured };
  });
}

export function defaultTitle(product: Product, now = new Date()) {
  return `${productInfo(product).name} · ${formatDate(now)}`;
}

export async function createReport(user: UserRow, product: Product) {
  if (!isEnabledProduct(product)) throw new Error("PRODUCT_DISABLED");
  const report = await createDraftReport(user.id, product, defaultTitle(product));
  await track(user.publicId, "report.created", { product });
  return report;
}

export const patchSchema = z
  .object({
    title: z.string().trim().min(1, "Give the report a title.").max(120, "Use 120 characters or fewer.").optional(),
    intake: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((v) => !v.intake || JSON.stringify(v.intake).length <= MAX_INTAKE_BYTES, {
    message: "The form data is too large.",
    path: ["intake"],
  });

export async function saveReport(user: UserRow, id: string, body: unknown) {
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const updated = await updateReport(user.id, id, parsed.data);
  if (!updated) return { ok: false as const, status: 404, error: "Not found" };
  return { ok: true as const, report: updated };
}

export async function removeReport(user: UserRow, id: string) {
  const result = await deleteReportForUser(user.id, id);
  if (!result) return false;
  await track(user.publicId, "report.deleted", { product: result.report.product });
  // UploadThing deletion of result.utKeys is performed by the file service (batch B6); keys are queued.
  return true;
}

export const STATUS_LABEL: Record<(typeof REPORT_STATUSES)[number], string> = {
  draft: "Draft",
  queued: "Queued",
  running: "Running",
  ready: "Ready",
  failed: "Failed",
  needs_confirmation: "Needs confirmation",
};

export const STATUS_TONE = {
  draft: "neutral",
  queued: "info",
  running: "info",
  ready: "ok",
  failed: "bad",
  needs_confirmation: "warn",
} as const;

/** Where a report row opens (S-01 rule 3). */
export function reportHref(r: { id: string; product: Product; status: string }) {
  if (r.status === "queued" || r.status === "running") return `/app/reports/${r.id}/run`;
  if (r.status === "draft") return `/app/new/${r.product}?id=${r.id}`;
  return `/app/reports/${r.id}`;
}
