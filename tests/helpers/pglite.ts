/** In-memory Postgres for tests (no network). Applies the real migrations from ./drizzle. */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import { setDbOverride, type DB } from "@/lib/db/client";

export async function createTestDb() {
  const client = new PGlite({ extensions: { citext } });
  const instance = drizzle({ client, schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  const testDb = instance as unknown as DB;
  setDbOverride(testDb);
  return {
    db: testDb,
    client,
    async close() {
      setDbOverride(undefined);
      await client.close();
    },
  };
}
