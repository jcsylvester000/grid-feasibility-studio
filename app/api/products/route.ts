import { apiSession, json } from "@/lib/http";
import { productsWithTypicalTimes } from "@/lib/reports/service";

/** GET /api/products: enabled products with typical times (measured median or GRID estimate). */
export async function GET() {
  const a = await apiSession();
  if ("error" in a) return a.error;
  const products = await productsWithTypicalTimes();
  return json({
    products: products.map((p) => ({
      key: p.key, name: p.name, short: p.short, needs: p.needs, typicalMs: p.typicalMs, typicalIsEstimate: p.typicalIsEstimate,
    })),
  });
}
