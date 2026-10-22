import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** Liveness plus a database round trip. Reports names of problems only, never secrets. */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "not_configured" | "error" = "ok";
  let tables: number | null = null;
  try {
    const res = (await db().execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    )) as unknown as { rows: { n: number }[] };
    tables = res.rows[0]?.n ?? null;
  } catch (err) {
    database = err instanceof Error && err.message.includes("DATABASE_URL") ? "not_configured" : "error";
  }
  return NextResponse.json(
    { ok: database === "ok", database, tables, ms: Date.now() - started, version: "b0" },
    { status: database === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
