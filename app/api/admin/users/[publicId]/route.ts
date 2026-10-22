import { userDetail } from "@/lib/db/repos/admin";
import { apiAdmin, json, jsonError } from "@/lib/http";

/** GET /api/admin/users/{publicId} (AD-03): usage aggregates and recent events (type and time only). */
export async function GET(_req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const a = await apiAdmin();
  if ("error" in a) return a.error;
  const d = await userDetail((await params).publicId);
  return d ? json(d) : jsonError(404, "NOT_FOUND", "User not found");
}
