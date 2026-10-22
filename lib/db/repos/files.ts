/**
 * Files (BRD section 9). Reads are owner-scoped through the report's user_id. Deleting rows always
 * queues the UploadThing keys in pending_file_deletions in the same transaction, so a failed
 * storage call is retried by the daily cleanup (UP-06, 14.2).
 */
import { and, asc, count, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "../client";
import { files, pendingFileDeletions, reports } from "../schema";
import { isUuid } from "./reports";

export type FileRow = typeof files.$inferSelect;

export async function insertFile(values: { reportId: string; utKey: string; name: string; mimeType: string; sizeBytes: number; docType: string | null; deleteAfter: Date }) {
  const db = await getDb();
  const [f] = await db.insert(files).values(values).onConflictDoNothing({ target: files.utKey }).returning();
  return f ?? null;
}

export async function countFilesForReport(reportId: string) {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(files).where(eq(files.reportId, reportId));
  return Number(r?.n ?? 0);
}

export async function listFilesForReport(reportId: string) {
  const db = await getDb();
  return db.select().from(files).where(eq(files.reportId, reportId)).orderBy(asc(files.createdAt), asc(files.id));
}

export async function getFileForUser(userId: string, fileId: string) {
  if (!isUuid(fileId)) return null;
  const db = await getDb();
  const [r] = await db
    .select({ file: files, report: reports })
    .from(files)
    .innerJoin(reports, eq(files.reportId, reports.id))
    .where(and(eq(files.id, fileId), eq(reports.userId, userId)))
    .limit(1);
  return r ?? null;
}

export async function setFileDocType(fileId: string, docType: string | null) {
  const db = await getDb();
  const [f] = await db.update(files).set({ docType }).where(eq(files.id, fileId)).returning();
  return f ?? null;
}

/** Deletes one file row and queues its storage key. */
export async function deleteFileRow(fileId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [f] = await tx.delete(files).where(eq(files.id, fileId)).returning();
    if (f) await tx.insert(pendingFileDeletions).values({ utKey: f.utKey }).onConflictDoNothing();
    return f ?? null;
  });
}

/** Files used by a run stay 90 days after that run (UP-06). */
export async function extendRetention(fileIds: string[], deleteAfter: Date) {
  if (!fileIds.length) return;
  const db = await getDb();
  await db.update(files).set({ deleteAfter }).where(inArray(files.id, fileIds));
}

/** Expired files: rows removed and keys queued in one transaction; returns the keys. */
export async function expireFiles(now = new Date(), limit = 500) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: files.id, utKey: files.utKey }).from(files).where(lt(files.deleteAfter, now)).limit(limit);
    if (!rows.length) return [] as string[];
    await tx.insert(pendingFileDeletions).values(rows.map((r) => ({ utKey: r.utKey }))).onConflictDoNothing();
    await tx.delete(files).where(inArray(files.id, rows.map((r) => r.id)));
    return rows.map((r) => r.utKey);
  });
}

export async function pendingDeletionKeys(limit = 500) {
  const db = await getDb();
  const rows = await db.select({ utKey: pendingFileDeletions.utKey }).from(pendingFileDeletions).orderBy(asc(pendingFileDeletions.createdAt)).limit(limit);
  return rows.map((r) => r.utKey);
}

export async function clearPendingDeletions(keys: string[]) {
  if (!keys.length) return;
  const db = await getDb();
  await db.delete(pendingFileDeletions).where(inArray(pendingFileDeletions.utKey, keys));
}

export async function bumpPendingDeletions(keys: string[]) {
  if (!keys.length) return;
  const db = await getDb();
  await db.update(pendingFileDeletions).set({ attempts: sql`${pendingFileDeletions.attempts} + 1` }).where(inArray(pendingFileDeletions.utKey, keys));
}
