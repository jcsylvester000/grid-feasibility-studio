import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth/service";
import { clearSessionCookies, currentToken, getCurrentSession, isSameOrigin } from "@/lib/auth/session";
import { track } from "@/lib/usage/track";

/** POST /api/auth/logout: deletes the session row and both cookies (AU-08), then goes home. */
export async function POST() {
  if (!(await isSameOrigin())) return NextResponse.json({ error: { code: "BAD_ORIGIN", message: "Bad origin" } }, { status: 403 });
  const s = await getCurrentSession();
  await endSession(await currentToken());
  await clearSessionCookies();
  if (s) await track(s.user.publicId, "user.logout");
  return NextResponse.redirect(new URL("/", process.env.APP_ORIGIN ?? "http://localhost:3000"), 303);
}
