/**
 * Creates an admin account (admins cannot be chosen at registration, BRD section 5).
 *   npm run admin:create -- --username gridadmin
 * Prints a generated password and recovery key ONCE. Store them in a password manager.
 */
import { config } from "dotenv";
import { randomInt } from "node:crypto";

config({ path: ".env.local" });

async function main() {
  const i = process.argv.indexOf("--username");
  const username = i > -1 ? process.argv[i + 1] : undefined;
  if (!username) {
    console.error('Usage: npm run admin:create -- --username <name>');
    process.exit(1);
  }
  const { checkUsername } = await import("../lib/auth/username");
  const { generateRecoveryKey, formatRecoveryKey, CROCKFORD } = await import("../lib/auth/ids");
  const { hashPassword } = await import("../lib/auth/password");
  const { getDb } = await import("../lib/db/client");
  const { insertUser, findUserByUsername } = await import("../lib/db/repos/users");
  const { legal } = await import("../content/site");

  const u = checkUsername(username);
  if (!u.ok) throw new Error(`Username not allowed: ${u.reason}`);
  if (await findUserByUsername(u.value)) throw new Error("That username is taken.");

  const password = Array.from({ length: 24 }, () => CROCKFORD[randomInt(CROCKFORD.length)]).join("").replace(/(.{6})(?!$)/g, "$1-");
  const recoveryKey = generateRecoveryKey();
  const db = await getDb();
  const user = await db.transaction(async (tx) =>
    insertUser(tx, {
      username: u.value,
      passwordHash: await hashPassword(password),
      recoveryKeyHash: await hashPassword(recoveryKey),
      role: "admin",
      termsVersion: legal.termsVersion,
      privacyVersion: legal.privacyVersion,
    }),
  );
  console.log("\nAdmin account created. Shown once; store these safely:\n");
  console.log(`  Username:     ${user.displayUsername}`);
  console.log(`  User ID:      ${user.publicId}`);
  console.log(`  Password:     ${password}`);
  console.log(`  Recovery key: ${formatRecoveryKey(recoveryKey)}\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error("admin:create failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
