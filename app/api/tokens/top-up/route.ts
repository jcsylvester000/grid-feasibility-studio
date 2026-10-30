import { apiSession, json, jsonError } from "@/lib/http";
import { topUpTokens } from "@/lib/db/repos/tokens";
import { demoEnabled } from "@/lib/demo/seed";
import { DEMO_TOP_UP, tokensEnabled } from "@/lib/tokens/config";
import { track } from "@/lib/usage/track";

/** POST /api/tokens/top-up: demo wallets only (DEMO_MODE=true or development). Adds DEMO_TOP_UP tokens. */
export async function POST() {
  if (!tokensEnabled() || !demoEnabled()) return jsonError(404, "NOT_FOUND", "Not found");
  const a = await apiSession({ mutating: true });
  if ("error" in a) return a.error;
  const balance = await topUpTokens(a.session.user.id, DEMO_TOP_UP);
  await track(a.session.user.publicId, "tokens.topped_up", {});
  return json({ balance });
}
