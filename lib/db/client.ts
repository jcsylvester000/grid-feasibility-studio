/**
 * Database client. Only repositories (lib/db/repos) import this module (BRD 14.2).
 *  - Default (DB_DRIVER=neon): Neon pooled connection over WebSockets (interactive transactions).
 *  - DB_DRIVER=pglite: embedded Postgres in PGLITE_DIR (or memory), migrated on first use.
 *    For automated end-to-end tests and offline work only; never in production.
 * Created on first use, never at import, so builds work without DATABASE_URL.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type DB = NeonDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

declare global {
  var __gridDb: Promise<DB> | undefined;
  var __gridDbOverride: DB | undefined;
}

async function createPglite(): Promise<DB> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PGLITE !== "true")
    throw new Error("DB_DRIVER=pglite is for local tests only");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(process.env.PGLITE_DIR || undefined);
  const instance = drizzle({ client, schema });
  await migrate(instance, { migrationsFolder: `${process.cwd()}/drizzle` });
  // Test-only: seed an admin as "username:password" (end-to-end tests cannot run admin:create on PGlite).
  const seed = process.env.PGLITE_SEED_ADMIN;
  if (seed) {
    const [username, password] = seed.split(":") as [string, string];
    const { hashPassword } = await import("@/lib/auth/password");
    const exists = await client.query("select 1 from users where lower(username) = lower($1)", [username]);
    if (!exists.rows.length) {
      await instance.insert(schema.users).values({
        publicId: "U-ADM1N0",
        username,
        displayUsername: username,
        passwordHash: await hashPassword(password),
        recoveryKeyHash: await hashPassword("unused-recovery-key"),
        role: "admin",
        termsVersion: "seed",
        privacyVersion: "seed",
      });
    }
  }
  return instance as unknown as DB;
}

function createNeon(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing environment variable DATABASE_URL");
  if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({ connectionString: url, max: 5 });
  return drizzleNeon({ client: pool, schema });
}

export async function getDb(): Promise<DB> {
  if (globalThis.__gridDbOverride) return globalThis.__gridDbOverride;
  if (!globalThis.__gridDb) {
    globalThis.__gridDb = process.env.DB_DRIVER === "pglite" ? createPglite() : Promise.resolve().then(createNeon);
    globalThis.__gridDb.catch(() => (globalThis.__gridDb = undefined));
  }
  return globalThis.__gridDb;
}

/** Tests: point every repository at another database (PGlite). */
export function setDbOverride(instance: DB | undefined) {
  globalThis.__gridDbOverride = instance;
}

/** True when a Postgres error is a unique-constraint violation. */
export function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export { schema };
