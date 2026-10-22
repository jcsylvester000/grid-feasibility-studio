import { NextResponse } from "next/server";
import { getCurrentSession, readRecoveryKeyFlash } from "@/lib/auth/session";
import { formatRecoveryKey } from "@/lib/auth/ids";

/** GET /api/account/recovery-key/flash: the one-time key while it is still shown; 410 afterwards. */
export async function GET() {
  const s = await getCurrentSession();
  if (!s) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first" } }, { status: 401 });
  const key = await readRecoveryKeyFlash(s.user.id);
  if (!key) return NextResponse.json({ error: { code: "GONE", message: "This key is no longer shown" } }, { status: 410 });
  return NextResponse.json({ key: formatRecoveryKey(key), publicId: s.user.publicId }, { headers: { "cache-control": "no-store" } });
}
