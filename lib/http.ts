import "server-only";
/** JSON helpers for route handlers: { error: { code, message } } (BRD section 13). */
import { NextResponse } from "next/server";
import { getCurrentSession, isSameOrigin } from "@/lib/auth/session";

export const jsonError = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

export const json = <T>(body: T, init: ResponseInit = {}) =>
  NextResponse.json(body, { ...init, headers: { "cache-control": "no-store", ...(init.headers ?? {}) } });

/** Signed-in user for API routes; mutating requests also need a same-origin Origin header (SE-04). */
export async function apiSession(opts: { mutating?: boolean } = {}) {
  if (opts.mutating && !(await isSameOrigin())) return { error: jsonError(403, "BAD_ORIGIN", "Request origin not allowed") } as const;
  const s = await getCurrentSession();
  if (!s) return { error: jsonError(401, "UNAUTHENTICATED", "Sign in first") } as const;
  return { session: s } as const;
}
