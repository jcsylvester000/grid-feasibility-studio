/**
 * Files for a run (VS-03, UP-04): the report's files in upload order (at most 10), read through
 * 5-minute signed URLs and forwarded as inputs.file_1 ... file_10, and listed in run_request.documents.
 * Files used by a run are kept 90 days from that run (UP-06).
 */
import { extendRetention, listFilesForReport } from "@/lib/db/repos/files";
import type { RunDocument } from "@/lib/runs/run-request";
import type { PipelineFile } from "@/lib/vectorshift/client";
import { DOC_TYPES, DOCUMENT_RULES } from "./config";
import { storage } from "./storage";

export async function loadRunFiles(_runId: string, reportId: string, alsoFrom: string[] = [], now = new Date()): Promise<{ documents: RunDocument[]; files: PipelineFile[] }> {
  // This report's files first, then any from the report it was started from (same name and size counted once).
  const own = await listFilesForReport(reportId);
  const extra = (await Promise.all(alsoFrom.map((id) => listFilesForReport(id)))).flat();
  const seen = new Set(own.map((f) => `${f.name}|${f.sizeBytes}`));
  const rows = [...own, ...extra.filter((f) => !seen.has(`${f.name}|${f.sizeBytes}`))].slice(0, DOCUMENT_RULES.maxFiles);
  if (!rows.length) return { documents: [], files: [] };
  const s = storage();
  const documents: RunDocument[] = [];
  const files: PipelineFile[] = [];
  for (const [i, f] of rows.entries()) {
    const [{ url, expiresAt }, bytes] = await Promise.all([s.signedUrl(f.utKey), s.read(f.utKey)]);
    const label = DOC_TYPES.find((d) => d.value === f.docType)?.label;
    documents.push({
      doc_ref: `doc-${i + 1}`,
      file_name: f.name,
      mime: f.mimeType,
      url,
      expires_at: expiresAt.toISOString(),
      ...(label ? { user_label: label } : {}),
      ...(f.docType && f.docType !== "other" ? { capability: f.docType } : {}),
    });
    files.push({ name: f.name, mime: f.mimeType, bytes });
  }
  await extendRetention(rows.map((r) => r.id), new Date(now.getTime() + DOCUMENT_RULES.retentionDays * 86400_000));
  return { documents, files };
}

/** docs.<type> = doc_ref for each tagged document (field dictionary docs.* keys). */
export function docsIntake(documents: RunDocument[]) {
  const out: Record<string, string> = {};
  for (const d of documents) if (d.capability && !out[`docs.${d.capability}`]) out[`docs.${d.capability}`] = d.doc_ref;
  return out;
}
