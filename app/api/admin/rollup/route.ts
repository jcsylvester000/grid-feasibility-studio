import { runRollup } from "@/lib/admin/service";
import { apiAdmin, json } from "@/lib/http";

/** POST /api/admin/rollup: refresh today's usage_daily rows on demand (11.4). */
export async function POST() {
  const a = await apiAdmin({ mutating: true });
  if ("error" in a) return a.error;
  return json(await runRollup(new Date(), { todayOnly: true }));
}
