/**
 * Reports, always scoped to their owner: every read and write includes user_id, so another user's
 * report id behaves exactly like a missing one (404, AC-020, AC-031).
 */
import { and, count, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "../client";
import { files, pendingFileDeletions, reports, runs, type Product, type ReportStatus } from "../schema";

export type ReportRow = typeof reports.$inferSelect;

export async function createDraftReport(userId: string, product: Product, title: string, intake: Record<string, unknown> = {}) {
  const db = await getDb();
  const [r] = await db.insert(reports).values({ userId, product, title, intake }).returning();
  return r!;
}

export async function listReportTitles(userId: string) {
  const db = await getDb();
  const rows = await db.select({ title: reports.title }).from(reports).where(eq(reports.userId, userId));
  return rows.map((r) => r.title);
}

export async function getReportForUser(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [r] = await db.select().from(reports).where(and(eq(reports.id, id), eq(reports.userId, userId))).limit(1);
  return r ?? null;
}

export type ReportFilters = { q?: string; product?: Product; status?: ReportStatus; page?: number; pageSize?: number };

export async function listReports(userId: string, f: ReportFilters = {}) {
  const db = await getDb();
  const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 100);
  const page = Math.max(f.page ?? 1, 1);
  const where: SQL[] = [eq(reports.userId, userId)];
  if (f.q?.trim()) where.push(ilike(reports.title, `%${escapeLike(f.q.trim())}%`));
  if (f.product) where.push(eq(reports.product, f.product));
  if (f.status) where.push(eq(reports.status, f.status));
  const cond = and(...where);
  const [items, [{ total } = { total: 0 }]] = await Promise.all([
    db
      .select({
        id: reports.id,
        title: reports.title,
        product: reports.product,
        status: reports.status,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
      })
      .from(reports)
      .where(cond)
      .orderBy(desc(reports.updatedAt), desc(reports.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(reports).where(cond),
  ]);
  return { items, total: Number(total), page, pageSize };
}

export async function updateReport(userId: string, id: string, values: { intake?: Record<string, unknown>; title?: string }) {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [r] = await db
    .update(reports)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(reports.id, id), eq(reports.userId, userId)))
    .returning();
  return r ?? null;
}

/**
 * Deletes a report with its runs, envelopes and file rows (cascade). UploadThing keys are queued in
 * pending_file_deletions in the same transaction; the file service deletes them (B6, UP-06).
 */
export async function deleteReportForUser(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(reports).where(and(eq(reports.id, id), eq(reports.userId, userId))).limit(1);
    if (!r) return null;
    const keys = await tx.select({ utKey: files.utKey }).from(files).where(eq(files.reportId, id));
    if (keys.length) await tx.insert(pendingFileDeletions).values(keys).onConflictDoNothing();
    await tx.delete(reports).where(eq(reports.id, id));
    return { report: r, utKeys: keys.map((k) => k.utKey) };
  });
}

/** All UploadThing keys of a user's files (account deletion). */
export async function fileKeysForUser(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({ utKey: files.utKey })
    .from(files)
    .innerJoin(reports, eq(files.reportId, reports.id))
    .where(eq(reports.userId, userId));
  return rows.map((r) => r.utKey);
}

export async function queueFileDeletions(utKeys: string[]) {
  if (!utKeys.length) return;
  const db = await getDb();
  await db.insert(pendingFileDeletions).values(utKeys.map((utKey) => ({ utKey }))).onConflictDoNothing();
}

/**
 * Typical run time per product: median duration of the last 50 succeeded runs, when at least 20 exist
 * (BRD S-01); otherwise null and the caller shows the GRID estimate.
 */
export async function typicalDurations(products: Product[]) {
  const db = await getDb();
  const rows = await db.execute(sql`
    with recent as (
      select product, duration_ms,
             row_number() over (partition by product order by finished_at desc) as rn
      from runs
      where status = 'succeeded' and duration_ms is not null and ${inArray(runs.product, products)}
    )
    select product, count(*)::int as n,
           percentile_cont(0.5) within group (order by duration_ms)::int as median_ms
    from recent where rn <= 50 group by product`);
  const out: Partial<Record<Product, { n: number; medianMs: number }>> = {};
  for (const r of (rows as unknown as { rows: { product: Product; n: number; median_ms: number }[] }).rows)
    out[r.product] = { n: Number(r.n), medianMs: Number(r.median_ms) };
  return out;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
