import { and, eq, ne } from "drizzle-orm";
import { getDb, type Tx } from "../client";
import { sessions, users } from "../schema";

export async function insertSession(
  tx: Tx | null,
  values: { tokenHash: string; userId: string; expiresAt: Date; absoluteExpiresAt: Date },
) {
  const db = tx ?? (await getDb());
  await db.insert(sessions).values(values);
}

export async function findSessionWithUser(tokenHash: string) {
  const db = await getDb();
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  return row ?? null;
}

export async function extendSession(tokenHash: string, lastSeenAt: Date, expiresAt: Date) {
  const db = await getDb();
  await db.update(sessions).set({ lastSeenAt, expiresAt }).where(eq(sessions.tokenHash, tokenHash));
}

export async function deleteSession(tokenHash: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/** Ends every session of a user, optionally keeping one (AU-09, S-07 log out of all devices). */
export async function deleteUserSessions(tx: Tx | null, userId: string, exceptTokenHash?: string) {
  const db = tx ?? (await getDb());
  await db
    .delete(sessions)
    .where(exceptTokenHash ? and(eq(sessions.userId, userId), ne(sessions.tokenHash, exceptTokenHash)) : eq(sessions.userId, userId));
}

export async function countUserSessions(userId: string) {
  const db = await getDb();
  return (await db.select({ t: sessions.tokenHash }).from(sessions).where(eq(sessions.userId, userId))).length;
}
