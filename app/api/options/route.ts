import type { NextRequest } from "next/server";
import { apiSession, json, jsonError } from "@/lib/http";
import { getOptions } from "@/lib/options";
import { isEnabledProduct } from "@/lib/reports/service";

/** GET /api/options?product= : dropdown options and the field dictionary for a product. */
export async function GET(req: NextRequest) {
  const a = await apiSession();
  if ("error" in a) return a.error;
  const product = req.nextUrl.searchParams.get("product") ?? "";
  if (!isEnabledProduct(product)) return jsonError(400, "UNKNOWN_PRODUCT", "Unknown or disabled product");
  return json(getOptions(product));
}
