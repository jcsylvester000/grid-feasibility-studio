import { periodFrom } from "@/lib/admin/service";
import { topUsers, usageSeries } from "@/lib/db/repos/admin";
import { apiAdmin, json } from "@/lib/http";

/** GET /api/admin/usage/timeseries: runs per day by product, active users per day, failures by code, top User IDs. */
export async function GET(req: Request) {
  const a = await apiAdmin();
  if ("error" in a) return a.error;
  const { period } = periodFrom(Object.fromEntries(new URL(req.url).searchParams));
  return json({ period, ...(await usageSeries(period)), topUsers: await topUsers(period) });
}
