import { NextResponse } from "next/server";
import { getCurrentSession, readRecoveryKeyFlash } from "@/lib/auth/session";
import { formatRecoveryKey } from "@/lib/auth/ids";

/** GET: the recovery key as a .txt download (works without JavaScript). Nothing is stored server-side. */
export async function GET() {
  const s = await getCurrentSession();
  if (!s) return new NextResponse("Sign in first", { status: 401 });
  const key = await readRecoveryKeyFlash(s.user.id);
  if (!key) return new NextResponse("This key is no longer shown.", { status: 410 });
  const site = process.env.APP_ORIGIN ?? "http://localhost:3000";
  const body = [
    "GRID Feasibility Studio: recovery key",
    "",
    `Recovery key: ${formatRecoveryKey(key)}`,
    `User ID:      ${s.user.publicId}`,
    `Site:         ${site}`,
    "",
    "Keep this file somewhere safe. Use the key on the Reset password page if you forget your password.",
    "If you lose the key too, contact GRID support with your User ID.",
    "",
  ].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="grid-recovery-key-${s.user.publicId}.txt"`,
      "cache-control": "no-store",
    },
  });
}
