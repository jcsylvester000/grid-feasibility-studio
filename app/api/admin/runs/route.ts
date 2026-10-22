import { listRuns } from "@/lib/db/repos/admin";
import { apiAdmin, json } from "@/lib/http";

/** GET /api/admin/runs?product=&status=&code=&from=&to=&page= (AD-04). Metadata only (admin_runs_v). */
export async function GET(req: Request) {
  const a = await apiAdmin();
  if ("error" in a) return a.error;
  const p = Object.fromEntries(new URL(req.url).searchParams);
  return json(await listRuns({ product: p.product, status: p.status, code: p.code, from: p.from, to: p.to, page: Number(p.page) || 1 }));
}
