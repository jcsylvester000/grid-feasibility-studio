import { z } from "zod";
import { apiSession, json, jsonError } from "@/lib/http";
import { getReportForUser } from "@/lib/db/repos/reports";
import { track } from "@/lib/usage/track";

const Body = z.object({ event: z.enum(["printed"]) });

/** POST /api/reports/{id}/events: client-side usage events for a report the user owns (report.printed). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "VALIDATION", "Unknown event");
  const report = await getReportForUser(a.session.user.id, (await params).id);
  if (!report) return jsonError(404, "NOT_FOUND", "Report not found");
  await track(a.session.user.publicId, "report.printed", { product: report.product });
  return json({ ok: true });
}
