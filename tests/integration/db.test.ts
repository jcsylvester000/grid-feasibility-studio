import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "../helpers/pglite";
import { reports, runs, users } from "@/lib/db/schema";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());

async function makeUser(name: string) {
  const [u] = await t.db
    .insert(users)
    .values({
      publicId: `U-${name.toUpperCase().padEnd(6, "X").slice(0, 6)}`,
      username: name,
      displayUsername: name,
      passwordHash: "x",
      recoveryKeyHash: "x",
      termsVersion: "1",
      privacyVersion: "1",
    })
    .returning();
  return u!;
}

describe("database schema (migrations applied to PGlite)", () => {
  it("creates all application tables", async () => {
    const res = await t.db.execute(
      sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`,
    );
    const names = (res as unknown as { rows: { table_name: string }[] }).rows.map((r) => r.table_name);
    for (const n of [
      "users", "sessions", "auth_attempts", "reset_codes", "reports", "runs",
      "envelopes", "files", "usage_events", "usage_daily", "audit_log",
    ]) expect(names).toContain(n);
  });

  it("treats usernames case-insensitively (citext, AU-01)", async () => {
    await makeUser("Maria.Santos");
    await expect(makeUser("maria.santos")).rejects.toThrow();
    const found = await t.db.select().from(users).where(eq(users.username, "MARIA.SANTOS"));
    expect(found).toHaveLength(1);
  });

  it("allows only one queued or running run per report (14.1)", async () => {
    const u = await makeUser("runner01");
    const [r] = await t.db.insert(reports).values({ userId: u.id, product: "quick_report" }).returning();
    await t.db.insert(runs).values({ reportId: r!.id, product: "quick_report", pipelineId: "p" });
    await expect(
      t.db.insert(runs).values({ reportId: r!.id, product: "quick_report", pipelineId: "p" }),
    ).rejects.toThrow();
    await t.db.update(runs).set({ status: "failed" }).where(eq(runs.reportId, r!.id));
    await t.db.insert(runs).values({ reportId: r!.id, product: "quick_report", pipelineId: "p", attempt: 2 });
  });

  it("cascades deletes from users to reports and runs (14.2)", async () => {
    const u = await makeUser("cascade1");
    const [r] = await t.db.insert(reports).values({ userId: u.id, product: "executive_summary" }).returning();
    await t.db.insert(runs).values({ reportId: r!.id, product: "executive_summary", pipelineId: "p" });
    await t.db.delete(users).where(eq(users.id, u.id));
    expect(await t.db.select().from(reports).where(eq(reports.id, r!.id))).toHaveLength(0);
    expect(await t.db.select().from(runs).where(eq(runs.reportId, r!.id))).toHaveLength(0);
  });
});
