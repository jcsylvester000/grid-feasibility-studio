import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSession, json, jsonError } from "@/lib/http";
import { listReports } from "@/lib/db/repos/reports";
import { createReport, isEnabledProduct, productSchema, statusSchema } from "@/lib/reports/service";

/** GET /api/reports?q=&product=&status=&page=&limit= : the user's own reports, newest first. */
export async function GET(req: NextRequest) {
  const a = await apiSession();
  if ("error" in a) return a.error;
  const sp = req.nextUrl.searchParams;
  const product = productSchema.safeParse(sp.get("product") ?? undefined);
  const status = statusSchema.safeParse(sp.get("status") ?? undefined);
  const result = await listReports(a.session.user.id, {
    q: sp.get("q") ?? undefined,
    product: product.success ? product.data : undefined,
    status: status.success ? status.data : undefined,
    page: Number(sp.get("page") ?? 1) || 1,
    pageSize: Number(sp.get("limit") ?? 25) || 25,
  });
  return json(result);
}

/** POST /api/reports { product } : creates a draft (report.created). */
export async function POST(req: Request) {
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const body = z.object({ product: z.string() }).safeParse(await req.json().catch(() => null));
  if (!body.success || !isEnabledProduct(body.data.product)) return jsonError(400, "UNKNOWN_PRODUCT", "Unknown or disabled product");
  const report = await createReport(a.session.user, body.data.product);
  return json({ id: report.id, product: report.product, status: report.status }, { status: 201 });
}
