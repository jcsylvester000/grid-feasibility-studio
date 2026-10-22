/**
 * Admin support actions (AD-03): these write, so they use the main connection, and they address users by
 * public User ID only. Every action is written to audit_log with the admin's User ID and time (PV-06).
 */
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { auditLog, resetCodes, sessions, users } from "../schema";

export async function findUserByPublicId(publicId: string) {
  const db = await getDb();
  const [u] = await db.select({ id: users.id, publicId: users.publicId, role: users.role, status: users.status }).from(users).where(eq(users.publicId, publicId)).limit(1);
  return u ?? null;
}

export async function setStatusAndAudit(userId: string, status: "active" | "suspended", adminPublicId: string, targetPublicId: string, action: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ status }).where(eq(users.id, userId));
    if (status === "suspended") await tx.delete(sessions).where(eq(sessions.userId, userId)); // AU-13
    await tx.insert(auditLog).values({ adminPublicId, action, targetPublicId });
  });
}

export async function insertResetCodeAndAudit(values: { userId: string; codeHash: string; expiresAt: Date }, adminPublicId: string, targetPublicId: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(resetCodes).values({ ...values, issuedByPublicId: adminPublicId });
    await tx.insert(auditLog).values({ adminPublicId, action: "user.reset_code_issued", targetPublicId });
  });
}

export async function audit(adminPublicId: string, action: string, targetPublicId: string | null = null) {
  const db = await getDb();
  await db.insert(auditLog).values({ adminPublicId, action, targetPublicId });
}
