import { pipelines } from "@/lib/admin/service";
import { apiAdmin, json } from "@/lib/http";

/** GET /api/admin/pipelines (AD-05): one entry per product with health and warnings. */
export async function GET() {
  const a = await apiAdmin();
  if ("error" in a) return a.error;
  return json({ pipelines: await pipelines() });
}
