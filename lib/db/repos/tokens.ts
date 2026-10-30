/**
 * GRID Token wallet and ledger. Every balance change happens in one statement that also checks the
 * balance (balance >= cost), so concurrent runs cannot overspend, and every change writes a ledger row.
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, type Tx } from "../client";
import { tokenLedger, tokenWallets, type Product } from "../schema";
import { MAX_BALANCE, startingBalance } from "@/lib/tokens/config";

type Db = Awaited<ReturnType<typeof getDb>> | Tx;

export class InsufficientTokensError extends Error {
  constructor(
    public readonly balance: number,
    public readonly cost: number,
  ) {
    super(`not enough tokens: balance ${balance}, cost ${cost}`);
  }
}

/** Opens the wallet with the starting balance if the account has none yet. Returns the balance. */
export async function ensureWallet(db: Db, userId: string) {
  const start = startingBalance();
  const [created] = await db.insert(tokenWallets).values({ userId, balance: start }).onConflictDoNothing().returning();
  if (created) {
    await db.insert(tokenLedger).values({ userId, kind: "opening", delta: start, balanceAfter: start });
    return start;
  }
  const [w] = await db.select({ balance: tokenWallets.balance }).from(tokenWallets).where(eq(tokenWallets.userId, userId)).limit(1);
  return w?.balance ?? 0;
}

export async function getBalance(userId: string) {
  const db = await getDb();
  return ensureWallet(db, userId);
}

/** Deducts `cost` inside the caller's transaction; throws InsufficientTokensError. Returns the ledger id. */
export async function chargeTokens(
  tx: Tx,
  values: { userId: string; cost: number; product: Product; reportId: string; reportTitle: string; runId: string },
) {
  await ensureWallet(tx, values.userId);
  const [w] = await tx
    .update(tokenWallets)
    .set({ balance: sql`${tokenWallets.balance} - ${values.cost}`, updatedAt: new Date() })
    .where(and(eq(tokenWallets.userId, values.userId), gte(tokenWallets.balance, values.cost)))
    .returning({ balance: tokenWallets.balance });
  if (!w) {
    const [now] = await tx.select({ balance: tokenWallets.balance }).from(tokenWallets).where(eq(tokenWallets.userId, values.userId));
    throw new InsufficientTokensError(now?.balance ?? 0, values.cost);
  }
  const [entry] = await tx
    .insert(tokenLedger)
    .values({ userId: values.userId, kind: "charge", delta: -values.cost, balanceAfter: w.balance, product: values.product, reportId: values.reportId, reportTitle: values.reportTitle, runId: values.runId })
    .returning({ id: tokenLedger.id });
  return entry!.id;
}

/** Returns a charge (once). Safe to call more than once for the same charge. Returns true if refunded now. */
export async function refundCharge(db: Db, chargeId: string | null | undefined, runId?: string | null) {
  if (!chargeId) return false;
  const [charge] = await db.select().from(tokenLedger).where(and(eq(tokenLedger.id, chargeId), eq(tokenLedger.kind, "charge"))).limit(1);
  if (!charge) return false;
  const amount = -charge.delta;
  const run = async (t: Db) => {
    // The unique index on refund_of makes a second refund of the same charge fail before the balance moves.
    const [entry] = await t
      .insert(tokenLedger)
      .values({ userId: charge.userId, kind: "refund", delta: amount, balanceAfter: 0, product: charge.product, reportId: charge.reportId, reportTitle: charge.reportTitle, runId: runId ?? charge.runId, refundOf: charge.id })
      .onConflictDoNothing()
      .returning({ id: tokenLedger.id });
    if (!entry) return false;
    const [w] = await t
      .update(tokenWallets)
      .set({ balance: sql`${tokenWallets.balance} + ${amount}`, updatedAt: new Date() })
      .where(eq(tokenWallets.userId, charge.userId))
      .returning({ balance: tokenWallets.balance });
    await t.update(tokenLedger).set({ balanceAfter: w?.balance ?? 0 }).where(eq(tokenLedger.id, entry.id));
    return true;
  };
  // A transaction (a savepoint when called inside one), so the ledger row and the balance move together.
  return (db as Awaited<ReturnType<typeof getDb>>).transaction((tx) => run(tx));
}

/** Demo top-up: adds tokens up to MAX_BALANCE. Returns the new balance. */
export async function topUpTokens(userId: string, amount: number) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const before = await ensureWallet(tx, userId);
    const add = Math.max(0, Math.min(amount, MAX_BALANCE - before));
    if (!add) return before;
    const [w] = await tx
      .update(tokenWallets)
      .set({ balance: sql`${tokenWallets.balance} + ${add}`, updatedAt: new Date() })
      .where(eq(tokenWallets.userId, userId))
      .returning({ balance: tokenWallets.balance });
    await tx.insert(tokenLedger).values({ userId, kind: "top_up", delta: add, balanceAfter: w!.balance });
    return w!.balance;
  });
}

export async function listLedger(userId: string, limit = 50) {
  const db = await getDb();
  await ensureWallet(db, userId);
  return db.select().from(tokenLedger).where(eq(tokenLedger.userId, userId)).orderBy(desc(tokenLedger.seq)).limit(limit);
}
