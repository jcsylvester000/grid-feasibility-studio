/**
 * Admin rules (BRD section 11, AD-01 to AD-05): periods, pipeline warnings, CSV exports and the
 * support actions. Admins identify people by User ID only (PV-02).
 */
import { hashPassword } from "@/lib/auth/password";
import { generateResetCode, PUBLIC_ID_PATTERN } from "@/lib/auth/ids";
import { audit, findUserByPublicId, insertResetCodeAndAudit, setStatusAndAudit } from "@/lib/db/repos/admin-actions";
import { listRuns, listUsers, manilaDate, pipelineStats, rollupDay, purgeOldEvents, dailyRollups, type Period } from "@/lib/db/repos/admin";
import { PRODUCTS, type Product } from "@/lib/db/schema";
import { isTeaserScanEnabled } from "@/lib/flags";
import { maxConcurrent, pipelineId, timeoutMs } from "@/lib/runs/config";
import { track } from "@/lib/usage/track";

export const RANGES = { today: 0, "7d": 6, "30d": 29, "90d": 89 } as const;
export type RangeKey = keyof typeof RANGES | "custom";

/** Period from ?range=&from=&to= (Manila dates, inclusive). Default 30 days. */
export function periodFrom(params: { range?: string; from?: string; to?: string }, now = new Date()): { key: RangeKey; period: Period } {
  const today = manilaDate(now);
  const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  if (params.range === "custom" && isDate(params.from) && isDate(params.to)) {
    const [a, b] = [params.from!, params.to!].sort();
    return { key: "custom", period: { from: a!, to: b! } };
  }
  const key = (params.range && params.range in RANGES ? params.range : "30d") as keyof typeof RANGES;
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - RANGES[key] * 86400_000).toISOString().slice(0, 10);
  return { key, period: { from, to: today } };
}

/** AD-05 rule 1: warn when p95 is above 80% of the timeout or the 7-day success rate is under 95%. */
export function pipelineWarnings(s: { p95Ms: number | null; successRate7: number | null }, timeout: number) {
  const w: string[] = [];
  if (s.p95Ms !== null && s.p95Ms > 0.8 * timeout)
    w.push(`p95 run time ${Math.round(s.p95Ms / 1000)} s is above 80% of the ${Math.round(timeout / 1000)} s timeout`);
  if (s.successRate7 !== null && s.successRate7 < 0.95) w.push(`7-day success rate ${(s.successRate7 * 100).toFixed(1)}% is under 95%`);
  return w;
}

export async function pipelines(now = new Date()) {
  const products = PRODUCTS.filter((p) => p !== "teaser_intake" || isTeaserScanEnabled());
  return Promise.all(
    products.map(async (product) => {
      const stats = await pipelineStats(product, now);
      const timeout = timeoutMs(product as Product);
      return { product, pipelineId: pipelineId(product as Product) || null, timeoutMs: timeout, maxConcurrent: maxConcurrent(), ...stats, warnings: pipelineWarnings(stats, timeout) };
    }),
  );
}

// ------------------------------------------------------------------ CSV (no usernames, PV-02)

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formulas and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

export async function exportCsv(view: "users" | "runs" | "daily", period: Period, adminPublicId: string) {
  await audit(adminPublicId, `export.${view}`);
  if (view === "users") {
    const { items } = await listUsers({ period, pageSize: 1000 });
    return toCsv(
      ["user_id", "role", "status", "registered", "last_active", "runs", "succeeded", "failed", "files", "storage_bytes"],
      items.map((u) => [u.public_id, u.role, u.status, u.created_at, u.last_active_at, u.runs, u.succeeded, u.failed, u.files, u.bytes]),
    );
  }
  if (view === "runs") {
    const { items } = await listRuns({ from: period.from, to: period.to, pageSize: 1000 });
    return toCsv(
      ["run_id", "user_id", "product", "pipeline_id", "status", "error_code", "http_status", "vs_run_id", "duration_ms", "queued_at", "started_at", "finished_at"],
      items.map((r) => [r.id, r.user_public_id, r.product, r.pipeline_id, r.status, r.error_code, r.http_status, r.vs_run_id, r.duration_ms, r.queued_at, r.started_at, r.finished_at]),
    );
  }
  const items = await dailyRollups(period);
  return toCsv(
    ["date", "product", "event", "count", "sum_duration_ms", "sum_bytes", "distinct_users"],
    items.map((d) => [d.date, d.product, d.event, d.count, d.sum_duration_ms, d.sum_bytes, d.distinct_users]),
  );
}

// ------------------------------------------------------------------ support actions (AD-03)

type Admin = { publicId: string };
export type ActionResult = { ok: true; code?: string; expiresAt?: Date } | { ok: false; status: number; message: string };

async function target(publicId: string) {
  if (!PUBLIC_ID_PATTERN.test(publicId)) return null;
  return findUserByPublicId(publicId);
}

export async function suspendUser(admin: Admin, publicId: string): Promise<ActionResult> {
  const u = await target(publicId);
  if (!u) return { ok: false, status: 404, message: "User not found" };
  if (u.publicId === admin.publicId) return { ok: false, status: 400, message: "You cannot suspend your own account." };
  if (u.role === "admin") return { ok: false, status: 400, message: "Admins cannot be suspended here." };
  await setStatusAndAudit(u.id, "suspended", admin.publicId, u.publicId, "user.suspended");
  await track(u.publicId, "user.suspended");
  return { ok: true };
}

export async function reactivateUser(admin: Admin, publicId: string): Promise<ActionResult> {
  const u = await target(publicId);
  if (!u) return { ok: false, status: 404, message: "User not found" };
  await setStatusAndAudit(u.id, "active", admin.publicId, u.publicId, "user.reactivated");
  await track(u.publicId, "user.reactivated");
  return { ok: true };
}

/** A one-time reset code, valid 24 hours, shown once (only its hash is stored). */
export async function issueResetCode(admin: Admin, publicId: string, now = new Date()): Promise<ActionResult> {
  const u = await target(publicId);
  if (!u) return { ok: false, status: 404, message: "User not found" };
  const code = generateResetCode();
  const expiresAt = new Date(now.getTime() + 24 * 3600_000);
  await insertResetCodeAndAudit({ userId: u.id, codeHash: await hashPassword(code), expiresAt }, admin.publicId, u.publicId);
  await track(u.publicId, "user.reset_code_issued");
  return { ok: true, code, expiresAt };
}

// ------------------------------------------------------------------ rollup (11.4)

/** Nightly: yesterday and today (Manila). On demand: today. Also purges events older than 24 months (PV-05). */
export async function runRollup(now = new Date(), opts: { todayOnly?: boolean } = {}) {
  const today = manilaDate(now);
  const yesterday = manilaDate(new Date(now.getTime() - 86400_000));
  const days = opts.todayOnly ? [today] : [yesterday, today];
  for (const d of days) await rollupDay(d);
  if (!opts.todayOnly) await purgeOldEvents(now);
  return { days };
}
