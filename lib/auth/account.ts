/** Account page rules (S-07): change password, new recovery key, log out everywhere, delete account. */
import { getDb } from "@/lib/db/client";
import { fileKeysForUser, queueFileDeletions } from "@/lib/db/repos/reports";
import { deleteUserSessions, insertSession } from "@/lib/db/repos/sessions";
import { updateCredentials, type UserRow } from "@/lib/db/repos/users";
import { users } from "@/lib/db/schema";
import { track } from "@/lib/usage/track";
import { eq } from "drizzle-orm";
import { randomToken, sha256 } from "./crypto";
import { generateRecoveryKey } from "./ids";
import { checkPassword, hashPassword, verifyPassword } from "./password";
import { LIMITS, type FieldErrors, type SessionGrant } from "./service";

/** AU-09: ends every session of the user and issues a new one for this device. */
export async function changePassword(
  user: UserRow,
  input: { current: string; password: string; confirmPassword: string },
): Promise<{ ok: true; session: SessionGrant } | { ok: false; fieldErrors: FieldErrors & { current?: string } }> {
  const fieldErrors: FieldErrors & { current?: string } = {};
  if (!(await verifyPassword(user.passwordHash, input.current))) fieldErrors.current = "That is not your current password.";
  const p = checkPassword(input.password, user.username);
  if (!p.ok) fieldErrors.password = p.reason;
  else if (input.password === input.current) fieldErrors.password = "Choose a password you have not used here.";
  if (input.password !== input.confirmPassword) fieldErrors.confirmPassword = "The passwords do not match.";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const token = randomToken(32);
  const expiresAt = new Date(now.getTime() + LIMITS.sessionIdleMs);
  const db = await getDb();
  await db.transaction(async (tx) => {
    await updateCredentials(tx, user.id, { passwordHash });
    await deleteUserSessions(tx, user.id);
    await insertSession(tx, {
      tokenHash: sha256(token),
      userId: user.id,
      expiresAt,
      absoluteExpiresAt: new Date(now.getTime() + LIMITS.sessionAbsoluteMs),
    });
  });
  await track(user.publicId, "user.password_changed");
  return { ok: true, session: { token, expiresAt } };
}

/** New recovery key after re-entering the password (A-04 rule 3). The old key stops working. */
export async function regenerateRecoveryKey(user: UserRow, password: string) {
  if (!(await verifyPassword(user.passwordHash, password))) return { ok: false as const, error: "That is not your current password." };
  const recoveryKey = generateRecoveryKey();
  const db = await getDb();
  await updateCredentials(db, user.id, { recoveryKeyHash: await hashPassword(recoveryKey) });
  await track(user.publicId, "user.recovery_key_regenerated");
  return { ok: true as const, recoveryKey };
}

/** S-07: ends every session, including this one (AC-035). */
export async function logoutEverywhere(user: UserRow) {
  await deleteUserSessions(null, user.id);
  await track(user.publicId, "user.logout");
}

/**
 * Deletes the account and everything it owns in one transaction (cascade). UploadThing keys are
 * queued for deletion first (UP-06). Usage events keep only the now-unlinked User ID (PV-04).
 */
export async function deleteAccount(user: UserRow, typedUsername: string) {
  if (typedUsername.trim().toLowerCase() !== user.username.toLowerCase())
    return { ok: false as const, error: "Type your username exactly to confirm." };
  await queueFileDeletions(await fileKeysForUser(user.id));
  const db = await getDb();
  await db.delete(users).where(eq(users.id, user.id));
  await track(user.publicId, "user.deleted");
  return { ok: true as const };
}
