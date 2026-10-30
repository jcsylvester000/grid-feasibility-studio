import { apiSession, json } from "@/lib/http";
import { getBalance } from "@/lib/db/repos/tokens";
import { tokenCosts, tokensEnabled } from "@/lib/tokens/config";

/** GET /api/tokens: the signed-in user's GRID Token balance and the cost per product. */
export async function GET() {
  const a = await apiSession();
  if ("error" in a) return a.error;
  if (!tokensEnabled()) return json({ enabled: false });
  return json({ enabled: true, balance: await getBalance(a.session.user.id), costs: tokenCosts() });
}
