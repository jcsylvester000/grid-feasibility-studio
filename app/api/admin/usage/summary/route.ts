import { periodFrom } from "@/lib/admin/service";
import { usageSummary } from "@/lib/db/repos/admin";
import { apiAdmin, json } from "@/lib/http";

/** GET /api/admin/usage/summary?range=today|7d|30d|90d|custom&from=&to= (AD-01 tiles). */
export async function GET(req: Request) {
  const a = await apiAdmin();
  if ("error" in a) return a.error;
  const { period } = periodFrom(Object.fromEntries(new URL(req.url).searchParams));
  return json({ period, ...(await usageSummary(period)) });
}
