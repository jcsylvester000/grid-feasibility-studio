import { and, eq, gte, lt, min, sql } from "drizzle-orm";
import { getDb } from "../client";
import { authAttempts } from "../schema";

type Kind = (typeof authAttempts.$inferInsert)["kind"];

export async function recordAttempt(kind: Kind, keyHash: string, at = new Date()) {
  const db = await getDb();
  await db.insert(authAttempts).values({ kind, keyHash, at });
}

/** Number of attempts since `since`, and the earliest one (to compute when the lock lifts). */
export async function attemptsSince(kind: Kind, keyHash: string, since: Date) {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int`, first: min(authAttempts.at) })
    .from(authAttempts)
    .where(and(eq(authAttempts.kind, kind), eq(authAttempts.keyHash, keyHash), gte(authAttempts.at, since)));
  return { count: Number(row?.n ?? 0), first: row?.first ? new Date(row.first) : null };
}

/** AU-11: addresses (and all attempt rows) are deleted after 24 hours. */
export async function purgeAttempts(olderThan: Date) {
  const db = await getDb();
  await db.delete(authAttempts).where(lt(authAttempts.at, olderThan));
}
