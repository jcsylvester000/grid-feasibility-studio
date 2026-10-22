import { periodFrom } from "@/lib/admin/service";
import { listUsers } from "@/lib/db/repos/admin";
import { apiAdmin, json } from "@/lib/http";

/** GET /api/admin/users?q=&status=&role=&sort=&page= (AD-02). q matches User IDs only (AC-038). */
export async function GET(req: Request) {
  const a = await apiAdmin();
  if ("error" in a) return a.error;
  const p = Object.fromEntries(new URL(req.url).searchParams);
  const { period } = periodFrom(p);
  const sort = p.sort === "runs" || p.sort === "storage" ? p.sort : "last_active";
  return json(await listUsers({ q: p.q, status: p.status, role: p.role, sort, page: Number(p.page) || 1, period }));
}
