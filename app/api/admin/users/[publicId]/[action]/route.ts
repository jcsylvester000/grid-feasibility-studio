import { issueResetCode, reactivateUser, suspendUser } from "@/lib/admin/service";
import { apiAdmin, json, jsonError } from "@/lib/http";

const ACTIONS = { suspend: suspendUser, reactivate: reactivateUser, "reset-code": issueResetCode } as const;

/** POST /api/admin/users/{publicId}/suspend | reactivate | reset-code (AD-03; audited, PV-06). */
export async function POST(_req: Request, { params }: { params: Promise<{ publicId: string; action: string }> }) {
  const a = await apiAdmin({ mutating: true });
  if ("error" in a) return a.error;
  const { publicId, action } = await params;
  const fn = ACTIONS[action as keyof typeof ACTIONS];
  if (!fn) return jsonError(404, "NOT_FOUND", "Not found");
  const r = await fn(a.session.user, publicId);
  if (!r.ok) return jsonError(r.status, r.status === 404 ? "NOT_FOUND" : "VALIDATION", r.message);
  return json({ ok: true, ...(r.code ? { code: r.code, expiresAt: r.expiresAt!.toISOString() } : {}) });
}
