/**
 * File rules (BRD section 9, UP-02 to UP-06): who may upload to which report, recording uploads,
 * owner downloads through signed URLs, deletion and the daily cleanup. Server code only (no
 * "server-only" marker: the Netlify cleanup function imports it, GFS-21).
 */
import { getReportForUser } from "@/lib/db/repos/reports";
import {
  bumpPendingDeletions,
  clearPendingDeletions,
  fileTotalsForReport,
  deleteFileRow,
  expireFiles,
  getFileForUser,
  insertFile,
  pendingDeletionKeys,
  setFileDocType,
  type FileRow,
} from "@/lib/db/repos/files";
import type { UserRow } from "@/lib/db/repos/users";
import { track } from "@/lib/usage/track";
import { checkFile, DOCUMENT_RULES, isDocType, mimeOf, MESSAGES, routeFor, type UploadRoute } from "./config";
import { storage } from "./storage";

export type Incoming = { name: string; size: number; type: string };
export type UploadDenied = { ok: false; status: number; message: string };

const LOCKED = new Set(["queued", "running"]);

/** UP-02: session (caller), report ownership, product, report not running, type, size and count. */
export async function authorizeUpload(user: UserRow, reportId: string, incoming: Incoming[], route?: UploadRoute) {
  const report = await getReportForUser(user.id, reportId);
  if (!report) return { ok: false, status: 404, message: "Report not found" } satisfies UploadDenied;
  const expected = routeFor(report.product);
  if (!expected || (route && route !== expected)) return { ok: false, status: 400, message: "This report does not take these files" } satisfies UploadDenied;
  if (LOCKED.has(report.status) || report.status === "needs_confirmation")
    return { ok: false, status: 409, message: "Files cannot change while the report is being prepared" } satisfies UploadDenied;
  const totals = await fileTotalsForReport(report.id);
  let bytes = totals.bytes;
  for (let i = 0; i < incoming.length; i++) {
    const reason = checkFile(incoming[i]!, totals.count + i + 1, expected, bytes);
    if (reason) return { ok: false, status: reason === MESSAGES.tooMany ? 409 : 400, message: reason } satisfies UploadDenied;
    bytes += incoming[i]!.size;
  }
  return { ok: true as const, report, route: expected };
}

/** UP-03: files row (delete_after) and a file.uploaded event with the byte size. */
export async function recordUpload(userPublicId: string, reportId: string, f: { key: string; name: string; type: string; size: number }, docType: unknown) {
  const row = await insertFile({
    reportId,
    utKey: f.key,
    name: f.name.slice(0, 255),
    mimeType: mimeOf(f.name, f.type),
    sizeBytes: f.size,
    docType: isDocType(docType) ? docType : null,
    deleteAfter: new Date(Date.now() + DOCUMENT_RULES.retentionDays * 86400_000),
  });
  if (row) await track(userPublicId, "file.uploaded", { bytes: f.size });
  return row;
}

/** Owner view of a file (no storage key). */
export const fileView = (f: FileRow) => ({ id: f.id, name: f.name, mimeType: f.mimeType, sizeBytes: f.sizeBytes, docType: f.docType, createdAt: f.createdAt.toISOString() });

export async function ownerSignedUrl(user: UserRow, fileId: string) {
  const r = await getFileForUser(user.id, fileId);
  if (!r) return null;
  return storage().signedUrl(r.file.utKey);
}

export async function changeDocType(user: UserRow, fileId: string, docType: unknown) {
  const r = await getFileForUser(user.id, fileId);
  if (!r) return null;
  if (docType !== null && !isDocType(docType)) return { error: "Unknown document type" } as const;
  return { file: await setFileDocType(fileId, docType) } as const;
}

export async function removeFile(user: UserRow, fileId: string) {
  const r = await getFileForUser(user.id, fileId);
  if (!r) return { ok: false as const, status: 404, message: "File not found" };
  if (LOCKED.has(r.report.status)) return { ok: false as const, status: 409, message: "Files cannot change while the report is being prepared" };
  const f = await deleteFileRow(fileId);
  if (f) {
    await drainDeletions([f.utKey]);
    await track(user.publicId, "file.deleted", { bytes: f.sizeBytes });
  }
  return { ok: true as const };
}

/**
 * UP-06: deletes queued keys from storage and clears them from the queue. Never throws: a failure
 * leaves the keys queued (attempts + 1) for the daily cleanup.
 */
export async function drainDeletions(keys?: string[]) {
  const batch = keys ?? (await pendingDeletionKeys());
  if (!batch.length) return { deleted: 0, failed: 0 };
  try {
    await storage().deleteKeys(batch);
    await clearPendingDeletions(batch);
    return { deleted: batch.length, failed: 0 };
  } catch (err) {
    console.error("file deletion failed; will retry:", err instanceof Error ? err.message : err);
    await bumpPendingDeletions(batch).catch(() => {});
    return { deleted: 0, failed: batch.length };
  }
}

/** Daily job: expire files past delete_after, then retry every queued deletion. */
export async function runFileCleanup(now = new Date()) {
  const expired = await expireFiles(now);
  const drained = await drainDeletions();
  return { expired: expired.length, ...drained };
}
