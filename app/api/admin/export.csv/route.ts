import { exportCsv, periodFrom } from "@/lib/admin/service";
import { apiAdmin, jsonError } from "@/lib/http";

/** GET /api/admin/export.csv?view=users|runs|daily&range=... CSV by User ID only (AC-039); audited (PV-06). */
export async function GET(req: Request) {
  const a = await apiAdmin();
  if ("error" in a) return a.error;
  const p = Object.fromEntries(new URL(req.url).searchParams);
  const view = p.view === "runs" || p.view === "daily" ? p.view : p.view === "users" || !p.view ? "users" : null;
  if (!view) return jsonError(400, "VALIDATION", "view must be users, runs or daily");
  const { period } = periodFrom(p);
  const csv = await exportCsv(view, period, a.session.user.publicId);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="grid-${view}-${period.from}-to-${period.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
