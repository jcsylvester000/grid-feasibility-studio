/**
 * Database access for admin pages (BRD 11.3 PV-01): DATABASE_URL_ADMIN_READER connects as admin_reader,
 * which can read only the admin views and usage_daily. Without it (local work, tests) the main connection
 * is used, and lib/db/repos/admin.ts still reads views only.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getDb, type DB } from "./client";
import * as schema from "./schema";

declare global {
  var __gridAdminDb: DB | undefined;
  var __gridAdminWarned: boolean | undefined;
}

export async function getAdminDb(): Promise<DB> {
  const url = process.env.DATABASE_URL_ADMIN_READER;
  if (globalThis.__gridDbOverride || !url || process.env.DB_DRIVER === "pglite") {
    if (!url && process.env.NODE_ENV === "production" && process.env.DB_DRIVER !== "pglite" && !globalThis.__gridAdminWarned) {
      globalThis.__gridAdminWarned = true;
      console.warn("admin: DATABASE_URL_ADMIN_READER is not set; admin pages use the main connection (PV-01 needs the admin_reader role)");
    }
    return getDb();
  }
  if (!globalThis.__gridAdminDb) {
    if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;
    globalThis.__gridAdminDb = drizzle({ client: new Pool({ connectionString: url, max: 3 }), schema });
  }
  return globalThis.__gridAdminDb;
}
