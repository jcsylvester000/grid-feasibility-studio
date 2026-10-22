import "server-only";
/**
 * Cookies, guards and request checks for the signed-in app (AU-07, AU-12, SE-04).
 * - grid_session: HttpOnly session token (only its SHA-256 hash is stored).
 * - grid_signed_in: non-secret "1" so static public pages can show "Go to dashboard".
 * - grid_flash: AES-GCM sealed one-time data (the recovery key) for the next page; never in a URL.
 */
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { seal, unseal } from "./crypto";
import { LIMITS, validateSession, type ActiveSession, type SessionGrant } from "./service";

export const SESSION_COOKIE = "grid_session";
export const SIGNED_IN_COOKIE = "grid_signed_in";
export const FLASH_COOKIE = "grid_flash";

const appOrigin = () => process.env.APP_ORIGIN ?? "http://localhost:3000";
const secure = () => appOrigin().startsWith("https://");

export async function setSessionCookies(grant: SessionGrant) {
  const jar = await cookies();
  const maxAge = Math.floor(LIMITS.sessionAbsoluteMs / 1000);
  jar.set(SESSION_COOKIE, grant.token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge });
  jar.set(SIGNED_IN_COOKIE, "1", { httpOnly: false, secure: secure(), sameSite: "lax", path: "/", maxAge });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_COOKIE);
}

/** The current session, loaded once per request from the database (never trusted from the cookie alone). */
export const getCurrentSession = cache(async (): Promise<ActiveSession | null> => {
  const jar = await cookies();
  return validateSession(jar.get(SESSION_COOKIE)?.value);
});

export async function currentToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** For pages and Server Actions: signed-in user or a redirect to /login (AU-12). */
export async function requireUser(nextPath?: string) {
  const s = await getCurrentSession();
  if (!s) {
    // A cookie whose session is gone: expired, logged out elsewhere or suspended (AC-040). Say so on the login page.
    const ended = !!(await cookies()).get(SESSION_COOKIE)?.value;
    const q = new URLSearchParams({ ...(ended ? { ended: "1" } : {}), ...(nextPath ? { next: nextPath } : {}) }).toString();
    redirect(q ? `/login?${q}` : "/login");
  }
  return s;
}

/** Admin pages: non-admins get a 404 so the admin area is not advertised. */
export async function requireAdmin(nextPath = "/admin") {
  const s = await requireUser(nextPath);
  if (s.user.role !== "admin") notFound();
  return s;
}

/** Network address for rate limits. Stored only as a keyed hash, never as text (AU-11). */
export async function clientAddress() {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

const originOf = (u: string | null | undefined) => {
  try {
    return u ? new URL(u).origin : null;
  } catch {
    return null;
  }
};

/**
 * SE-04: every mutating request must come from this site. Accepted when the browser's Origin equals APP_ORIGIN
 * (trailing slash and path ignored) or the host the request was served on (Netlify site, deploy previews,
 * a custom domain). A cross-site form cannot make the browser send an Origin that matches our own host.
 */
export async function isSameOrigin() {
  const h = await headers();
  const origin = originOf(h.get("origin"));
  if (!origin) return false;
  if (origin === originOf(appOrigin())) return true;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim().toLowerCase();
  if (host && new URL(origin).host.toLowerCase() === host) return true;
  console.warn(JSON.stringify({ event: "origin_mismatch", origin, app_origin: appOrigin(), host }));
  return false;
}

// ------------------------------------------------------------- flash (recovery key)

type Flash = { uid: string; key: string; exp: number };
const FLASH_TTL_MS = 15 * 60_000;

export async function setRecoveryKeyFlash(userId: string, key: string) {
  const jar = await cookies();
  jar.set(FLASH_COOKIE, seal({ uid: userId, key, exp: Date.now() + FLASH_TTL_MS } satisfies Flash), {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: FLASH_TTL_MS / 1000,
  });
}

/** Reads (does not consume) the recovery key flash for this user. */
export async function readRecoveryKeyFlash(userId: string) {
  const f = unseal<Flash>((await cookies()).get(FLASH_COOKIE)?.value);
  if (!f || f.uid !== userId || f.exp < Date.now()) return null;
  return f.key;
}

export async function clearRecoveryKeyFlash() {
  (await cookies()).delete(FLASH_COOKIE);
}
