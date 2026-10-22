import { apiSession, json, jsonError } from "@/lib/http";
import { ownerSignedUrl } from "@/lib/files/service";

/** GET /api/files/{id}/url: a 5-minute signed download URL for the owner (UP-04). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiSession();
  if ("error" in a) return a.error;
  const r = await ownerSignedUrl(a.session.user, (await params).id);
  if (!r) return jsonError(404, "NOT_FOUND", "File not found");
  return json({ url: r.url, expiresAt: r.expiresAt.toISOString() });
}
