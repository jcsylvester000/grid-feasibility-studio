/**
 * Loads the 20 demo scenarios into an existing account (prototype demos and training).
 *   npm run demo:seed -- --username <name>
 * Uses DATABASE_URL from .env.local. Safe to run again: scenarios already there are skipped.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const i = process.argv.indexOf("--username");
  const username = i > -1 ? process.argv[i + 1] : undefined;
  if (!username) {
    console.error("Usage: npm run demo:seed -- --username <name>");
    process.exit(1);
  }
  const { findUserByUsername } = await import("../lib/db/repos/users");
  const { seedDemoScenarios } = await import("../lib/demo/seed");
  const user = await findUserByUsername(username);
  if (!user) throw new Error("No account with that username. Register it in the app first.");
  const r = await seedDemoScenarios(user);
  console.log(`Demo scenarios: ${r.created} added (${r.total} in the set) for ${user.publicId}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
