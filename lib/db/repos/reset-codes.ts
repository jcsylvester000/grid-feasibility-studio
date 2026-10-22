import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, type Tx } from "../client";
import { resetCodes } from "../schema";

export async function findUsableResetCodes(userId: string, now = new Date()) {
  const db = await getDb();
  return db
    .select()
    .from(resetCodes)
    .where(and(eq(resetCodes.userId, userId), isNull(resetCodes.usedAt), gt(resetCodes.expiresAt, now)));
}

export async function markResetCodeUsed(tx: Tx, id: string, at = new Date()) {
  await tx.update(resetCodes).set({ usedAt: at }).where(eq(resetCodes.id, id));
}

export async function insertResetCode(values: { userId: string; codeHash: string; issuedByPublicId: string; expiresAt: Date }) {
  const db = await getDb();
  await db.insert(resetCodes).values(values);
}
