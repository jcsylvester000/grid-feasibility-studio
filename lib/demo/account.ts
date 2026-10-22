/**
 * Shared demo login (prototype showcases only). DEMO_LOGIN="username:password" in the environment; honoured only
 * while demo mode is on (DEMO_MODE=true, or development). The first sign-in with exactly these credentials creates
 * the account if it does not exist yet; after that it is an ordinary user account. Kept out of the code so no
 * password sits in the repository. Remove DEMO_LOGIN (and DEMO_MODE) before a real launch.
 */
import { legal } from "@/content/site";
import { generateRecoveryKey } from "@/lib/auth/ids";
import { hashPassword } from "@/lib/auth/password";
import { checkUsername } from "@/lib/auth/username";
import { getDb } from "@/lib/db/client";
import { findUserByUsername, insertUser, UsernameTakenError } from "@/lib/db/repos/users";
import { track } from "@/lib/usage/track";
import { demoEnabled } from "./seed";

export function demoLogin(): { username: string; password: string } | null {
  const raw = process.env.DEMO_LOGIN;
  if (!raw || !demoEnabled()) return null;
  const i = raw.indexOf(":");
  if (i < 1) return null;
  const username = raw.slice(0, i).trim();
  const password = raw.slice(i + 1);
  if (!checkUsername(username).ok || password.length < 8) return null;
  return { username, password };
}

/** Creates the demo account when these exact credentials are the configured demo login. Returns true if it exists now. */
export async function ensureDemoAccount(username: string, password: string): Promise<boolean> {
  const demo = demoLogin();
  if (!demo || username.trim().toLowerCase() !== demo.username.toLowerCase() || password !== demo.password) return false;
  if (await findUserByUsername(demo.username)) return true;
  const [passwordHash, recoveryKeyHash] = await Promise.all([hashPassword(demo.password), hashPassword(generateRecoveryKey())]);
  const db = await getDb();
  try {
    const user = await db.transaction((tx) =>
      insertUser(tx, { username: demo.username, passwordHash, recoveryKeyHash, termsVersion: legal.termsVersion, privacyVersion: legal.privacyVersion }),
    );
    await track(user.publicId, "user.registered");
  } catch (err) {
    if (!(err instanceof UsernameTakenError)) throw err;
  }
  return true;
}
