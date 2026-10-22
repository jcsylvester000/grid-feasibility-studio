import { z } from "zod";
import { apiSession, json, jsonError } from "@/lib/http";
import { changeDocType, fileView, removeFile } from "@/lib/files/service";

const Patch = z.object({ docType: z.string().nullable() });

/** PATCH /api/files/{id}: set what the document is (title, zoning certificate, ...). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const body = Patch.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(400, "VALIDATION", "docType is required");
  const r = await changeDocType(a.session.user, (await params).id, body.data.docType);
  if (!r) return jsonError(404, "NOT_FOUND", "File not found");
  if ("error" in r) return jsonError(400, "VALIDATION", r.error!);
  return json({ file: r.file ? fileView(r.file) : null });
}

/** DELETE /api/files/{id}: removes the row and the stored file (UP-06). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const r = await removeFile(a.session.user, (await params).id);
  if (!r.ok) return jsonError(r.status, r.status === 404 ? "NOT_FOUND" : "CONFLICT", r.message);
  return new Response(null, { status: 204 });
}
