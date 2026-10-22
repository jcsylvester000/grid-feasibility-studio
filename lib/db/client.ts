/**
 * Database client. Runtime uses the Neon pooled connection over WebSockets (interactive
 * transactions supported). Tests use PGlite (in-memory Postgres) through the same Drizzle API.
 * The client is created on first use, never at import, so builds work without DATABASE_URL.
 * Only repositories (lib/db/repos) should import this module (BRD 14.2).
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type DB = NeonDatabase<typeof schema>;

declare global {
  // Survives Next.js dev hot reloads.
  var __gridDb: DB | undefined;
  var __gridDbOverride: DB | undefined;
}

export function db(): DB {
  if (globalThis.__gridDbOverride) return globalThis.__gridDbOverride;
  if (globalThis.__gridDb) return globalThis.__gridDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing environment variable DATABASE_URL");
  if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({ connectionString: url, max: 5 });
  globalThis.__gridDb = drizzleNeon({ client: pool, schema });
  return globalThis.__gridDb;
}

/** Tests: point every repository at another database (PGlite). */
export function setDbOverride(instance: DB | undefined) {
  globalThis.__gridDbOverride = instance;
}

export { schema };
