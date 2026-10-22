import { eq, sql } from "drizzle-orm";
import { getDb, isUniqueViolation, type DB, type Tx } from "../client";
import { users, type UserRole } from "../schema";
import { generatePublicId } from "@/lib/auth/ids";

export type UserRow = typeof users.$inferSelect;

/** Case-insensitive username match, served by the unique index on lower(username). */
export const byUsername = (username: string) => eq(sql`lower(${users.username})`, username.trim().toLowerCase());

export async function findUserByUsername(username: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(byUsername(username)).limit(1);
  return u ?? null;
}

export async function findUserById(id: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

export async function usernameExists(username: string) {
  return (await findUserByUsername(username)) !== null;
}

/** Inserts a user with a fresh random public ID, retrying on the rare ID collision (AU-06). */
export async function insertUser(
  tx: Tx,
  values: {
    username: string;
    passwordHash: string;
    recoveryKeyHash: string;
    role?: UserRole;
    termsVersion: string;
    privacyVersion: string;
  },
): Promise<UserRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const publicId = generatePublicId();
    try {
      // Savepoint so a collision does not abort the surrounding transaction.
      return await tx.transaction(async (sp) => {
        const [u] = await sp
          .insert(users)
          .values({
            publicId,
            username: values.username,
            displayUsername: values.username,
            passwordHash: values.passwordHash,
            recoveryKeyHash: values.recoveryKeyHash,
            role: values.role ?? "user",
            termsVersion: values.termsVersion,
            privacyVersion: values.privacyVersion,
          })
          .returning();
        return u!;
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const taken = await tx.select({ id: users.id }).from(users).where(byUsername(values.username)).limit(1);
      if (taken.length) throw new UsernameTakenError();
    }
  }
  throw new Error("Could not allocate a unique User ID");
}

export class UsernameTakenError extends Error {
  constructor() {
    super("USERNAME_TAKEN");
  }
}

export async function updateCredentials(
  tx: Tx | DB,
  userId: string,
  values: { passwordHash?: string; recoveryKeyHash?: string },
) {
  await tx.update(users).set(values).where(eq(users.id, userId));
}

export async function touchLastActive(userId: string, at = new Date()) {
  const db = await getDb();
  await db.update(users).set({ lastActiveAt: at }).where(eq(users.id, userId));
}
