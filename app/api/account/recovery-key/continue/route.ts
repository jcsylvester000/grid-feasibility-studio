import { NextResponse } from "next/server";
import { clearRecoveryKeyFlash, getCurrentSession, isSameOrigin } from "@/lib/auth/session";

/**
 * POST (plain form, full page load): the user confirmed they saved the key. The flash is deleted so
 * the key is never shown again, even with the Back button (AC-013).
 */
export async function POST(req: Request) {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (!(await isSameOrigin())) return new NextResponse("Bad origin", { status: 403 });
  const s = await getCurrentSession();
  if (!s) return NextResponse.redirect(new URL("/login", origin), 303);
  const fd = await req.formData();
  if (fd.get("saved") !== "on") return NextResponse.redirect(new URL("/register/recovery-key?confirm=1", origin), 303);
  await clearRecoveryKeyFlash();
  return NextResponse.redirect(new URL(s.user.role === "admin" ? "/admin" : "/app", origin), 303);
}
