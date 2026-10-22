/**
 * Optimistic route guard (AU-12): requests to /app or /admin without a session cookie go to /login.
 * This is only a fast pre-check. Every page, Server Action and route handler still calls
 * requireUser() or requireAdmin(), which validates the session in the database.
 */
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (!request.cookies.has("grid_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/admin/:path*"] };
