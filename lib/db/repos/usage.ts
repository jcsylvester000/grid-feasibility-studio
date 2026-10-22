import { getDb } from "../client";
import { usageEvents } from "../schema";

export type UsageEventInsert = typeof usageEvents.$inferInsert;

export async function insertUsageEvent(values: UsageEventInsert) {
  const db = await getDb();
  await db.insert(usageEvents).values(values);
}
