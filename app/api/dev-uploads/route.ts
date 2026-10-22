import { apiSession, json, jsonError } from "@/lib/http";
import { randomToken } from "@/lib/auth/crypto";
import { DOCUMENT_RULES } from "@/lib/files/config";
import { authorizeUpload, fileView, recordUpload } from "@/lib/files/service";
import { uploadDriver, writeLocalFile } from "@/lib/files/storage";

/**
 * Local stand-in for UploadThing (UPLOAD_DRIVER=local; end-to-end tests and offline work only).
 * Runs the same checks as the UploadThing middleware and records the file the same way. 404 otherwise.
 */
export async function POST(req: Request) {
  if (uploadDriver() !== "local") return jsonError(404, "NOT_FOUND", "Not found");
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > DOCUMENT_RULES.maxBytes + 64 * 1024) return jsonError(413, "TOO_LARGE", "Files must be 25 MB or smaller");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const reportId = String(form?.get("reportId") ?? "");
  const docType = form?.get("docType") ? String(form.get("docType")) : null;
  if (!(file instanceof File)) return jsonError(400, "VALIDATION", "No file");
  const ok = await authorizeUpload(a.session.user, reportId, [{ name: file.name, size: file.size, type: file.type }]);
  if (!ok.ok) return jsonError(ok.status, ok.status === 404 ? "NOT_FOUND" : "UPLOAD_REFUSED", ok.message);
  const key = `local_${randomToken(18)}`;
  await writeLocalFile(key, new Uint8Array(await file.arrayBuffer()));
  const row = await recordUpload(a.session.user.publicId, reportId, { key, name: file.name, type: file.type, size: file.size }, docType);
  return json({ file: row ? fileView(row) : null }, { status: 201 });
}
