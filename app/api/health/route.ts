import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { dispatchMode } from "@/lib/runs/dispatch";
import { dispatchSecret } from "@/lib/runs/dispatch-secret";
import { inputMode, pipelineId, vectorShift } from "@/lib/runs/config";
import { isLiveProduct } from "@/lib/flags";

export const dynamic = "force-dynamic";

/** Liveness plus a database round trip. Reports names of problems only, never secrets. */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "not_configured" | "error" = "ok";
  let tables: number | null = null;
  try {
    const res = (await (await getDb()).execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    )) as unknown as { rows: { n: number }[] };
    tables = res.rows[0]?.n ?? null;
  } catch (err) {
    database = err instanceof Error && err.message.includes("DATABASE_URL") ? "not_configured" : "error";
  }
  // Run setup, as yes/no and names only (no values): helps find why a report cannot start.
  const runs = {
    dispatch: dispatchMode(),
    dispatch_secret: dispatchSecret() ? (process.env.INTERNAL_DISPATCH_SECRET ? "set" : "derived_from_app_secret") : "missing",
    quick_report: {
      live: isLiveProduct("quick_report"),
      pipeline_id: !!pipelineId("quick_report"),
      api_key: !!vectorShift("quick_report").apiKey,
      inputs: inputMode("quick_report"),
    },
  };
  return NextResponse.json(
    { ok: database === "ok", database, tables, runs, ms: Date.now() - started, version: "b12" },
    { status: database === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
