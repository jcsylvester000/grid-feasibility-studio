/**
 * Account service: business rules for registration, sign-in, reset and sessions (BRD section 10).
 * No cookies or redirects here (see lib/auth/session.ts), so the rules are unit-testable.
 */
import { getDb, type Tx } from "@/lib/db/client";
import { attemptsSince, purgeAttempts, recordAttempt } from "@/lib/db/repos/auth-attempts";
import { findUsableResetCodes, markResetCodeUsed } from "@/lib/db/repos/reset-codes";
import { deleteSession, deleteUserSessions, extendSession, findSessionWithUser, insertSession } from "@/lib/db/repos/sessions";
import {
  findUserByUsername,
  insertUser,
  touchLastActive,
  updateCredentials,
  UsernameTakenError,
  type UserRow,
} from "@/lib/db/repos/users";
import { legal } from "@/content/site";
import { track } from "@/lib/usage/track";
import { keyedHash, randomToken, sha256 } from "./crypto";
import { generateRecoveryKey, normalizeRecoveryKey } from "./ids";
import { checkPassword, dummyHash, hashPassword, verifyPassword } from "./password";
import { checkUsername } from "./username";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export const LIMITS = {
  sessionIdleMs: 7 * DAY, // AU-08 sliding
  sessionAbsoluteMs: 30 * DAY, // AU-08 absolute
  sessionRefreshMs: DAY, // refreshed at most once a day
  loginWindowMs: 15 * MIN, // AU-10
  loginPerUsername: 5,
  loginPerAddress: 20,
  lockMs: 15 * MIN,
  registerWindowMs: 60 * MIN, // AU-11
  registerPerAddress: 5,
  availabilityWindowMs: MIN,
  availabilityPerAddress: 30,
  attemptRetentionMs: DAY,
};

export type FieldErrors = Partial<Record<"username" | "password" | "confirmPassword" | "acceptTerms" | "secret", string>>;

export type SessionGrant = { token: string; expiresAt: Date };

const userKey = (username: string) => keyedHash("user", username.trim().toLowerCase());
const addressKey = (address: string) => keyedHash("addr", address || "unknown");

async function newSession(tx: Tx | null, userId: string, now: Date): Promise<SessionGrant> {
  const token = randomToken(32);
  const expiresAt = new Date(now.getTime() + LIMITS.sessionIdleMs);
  await insertSession(tx, {
    tokenHash: sha256(token),
    userId,
    expiresAt,
    absoluteExpiresAt: new Date(now.getTime() + LIMITS.sessionAbsoluteMs),
  });
  return { token, expiresAt };
}

/** Lock state for a username and an address (AU-10). */
async function lockState(username: string, address: string, now: Date) {
  const since = new Date(now.getTime() - LIMITS.loginWindowMs);
  const [byUser, byAddr] = await Promise.all([
    attemptsSince("login", userKey(username), since),
    attemptsSince("login_address", addressKey(address), since),
  ]);
  const locks: Date[] = [];
  if (byUser.count >= LIMITS.loginPerUsername && byUser.first) locks.push(new Date(byUser.first.getTime() + LIMITS.lockMs));
  if (byAddr.count >= LIMITS.loginPerAddress && byAddr.first) locks.push(new Date(byAddr.first.getTime() + LIMITS.lockMs));
  return locks.length ? new Date(Math.max(...locks.map((d) => d.getTime()))) : null;
}

async function recordFailure(username: string, address: string, now: Date) {
  await Promise.all([recordAttempt("login", userKey(username), now), recordAttempt("login_address", addressKey(address), now)]);
  // Opportunistic purge keeps auth_attempts at 24 hours (AU-11).
  if (Math.random() < 0.05) await purgeAttempts(new Date(now.getTime() - LIMITS.attemptRetentionMs));
}

// ---------------------------------------------------------------- register

export type RegisterResult =
  | { ok: true; user: UserRow; session: SessionGrant; recoveryKey: string }
  | { ok: false; fieldErrors?: FieldErrors; formError?: "RATE_LIMITED" };

export async function registerAccount(input: {
  username: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  address: string;
  now?: Date;
}): Promise<RegisterResult> {
  const now = input.now ?? new Date();
  const fieldErrors: FieldErrors = {};
  const u = checkUsername(input.username);
  if (!u.ok) fieldErrors.username = u.reason;
  const p = checkPassword(input.password, u.ok ? u.value : undefined);
  if (!p.ok) fieldErrors.password = p.reason;
  if (input.password !== input.confirmPassword) fieldErrors.confirmPassword = "The passwords do not match.";
  if (!input.acceptTerms) fieldErrors.acceptTerms = "Please accept the Terms and the Privacy Notice.";
  if (Object.keys(fieldErrors).length || !u.ok) return { ok: false, fieldErrors };

  const addr = addressKey(input.address);
  const recent = await attemptsSince("register", addr, new Date(now.getTime() - LIMITS.registerWindowMs));
  if (recent.count >= LIMITS.registerPerAddress) return { ok: false, formError: "RATE_LIMITED" };

  if (await findUserByUsername(u.value)) return { ok: false, fieldErrors: { username: "That username is taken. Try another." } };

  const recoveryKey = generateRecoveryKey();
  const [passwordHash, recoveryKeyHash] = await Promise.all([hashPassword(input.password), hashPassword(recoveryKey)]);
  const db = await getDb();
  try {
    const { user, session } = await db.transaction(async (tx) => {
      const user = await insertUser(tx, {
        username: u.value,
        passwordHash,
        recoveryKeyHash,
        termsVersion: legal.termsVersion,
        privacyVersion: legal.privacyVersion,
      });
      const session = await newSession(tx, user.id, now);
      return { user, session };
    });
    await recordAttempt("register", addr, now);
    await track(user.publicId, "user.registered");
    await track(user.publicId, "user.login");
    return { ok: true, user, session, recoveryKey };
  } catch (err) {
    if (err instanceof UsernameTakenError) return { ok: false, fieldErrors: { username: "That username is taken. Try another." } };
    throw err;
  }
}

/** On-blur availability check, rate limited per address. */
export async function isUsernameAvailable(username: string, address: string, now = new Date()) {
  const u = checkUsername(username);
  if (!u.ok) return { available: false, reason: u.reason };
  const key = addressKey(address);
  const recent = await attemptsSince("availability", key, new Date(now.getTime() - LIMITS.availabilityWindowMs));
  if (recent.count >= LIMITS.availabilityPerAddress) return { available: null, reason: "RATE_LIMITED" };
  await recordAttempt("availability", key, now);
  const taken = await findUserByUsername(u.value);
  return taken ? { available: false, reason: "That username is taken. Try another." } : { available: true };
}

// ---------------------------------------------------------------- login

export type LoginResult =
  | { ok: true; user: UserRow; session: SessionGrant }
  | { ok: false; code: "INVALID" | "LOCKED" | "SUSPENDED"; unlockAt?: Date };

export async function authenticate(input: { username: string; password: string; address: string; now?: Date }): Promise<LoginResult> {
  const now = input.now ?? new Date();
  const username = input.username.trim();
  const unlockAt = await lockState(username, input.address, now);
  if (unlockAt) return { ok: false, code: "LOCKED", unlockAt };

  const user = username ? await findUserByUsername(username) : null;
  const valid = user
    ? await verifyPassword(user.passwordHash, input.password)
    : (await verifyPassword(await dummyHash(), input.password), false);

  if (!user || !valid) {
    await recordFailure(username, input.address, now);
    if (user) await track(user.publicId, "user.login_failed");
    return { ok: false, code: "INVALID" };
  }
  if (user.status === "suspended") return { ok: false, code: "SUSPENDED" };

  const session = await newSession(null, user.id, now);
  await touchLastActive(user.id, now);
  await track(user.publicId, "user.login");
  return { ok: true, user, session };
}

// ---------------------------------------------------------------- reset

export type ResetResult =
  | { ok: true; user: UserRow; session: SessionGrant; recoveryKey: string }
  | { ok: false; code?: "INVALID" | "LOCKED" | "SUSPENDED"; unlockAt?: Date; fieldErrors?: FieldErrors };

export async function resetPassword(input: {
  username: string;
  secret: string;
  password: string;
  confirmPassword: string;
  address: string;
  now?: Date;
}): Promise<ResetResult> {
  const now = input.now ?? new Date();
  const username = input.username.trim();
  const fieldErrors: FieldErrors = {};
  const p = checkPassword(input.password, username);
  if (!p.ok) fieldErrors.password = p.reason;
  if (input.password !== input.confirmPassword) fieldErrors.confirmPassword = "The passwords do not match.";
  if (!input.secret.trim()) fieldErrors.secret = "Enter your recovery key or reset code.";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const unlockAt = await lockState(username, input.address, now);
  if (unlockAt) return { ok: false, code: "LOCKED", unlockAt };

  const user = username ? await findUserByUsername(username) : null;
  const secret = normalizeRecoveryKey(input.secret);
  let usedCodeId: string | null = null;
  let valid = false;
  if (user) {
    valid = await verifyPassword(user.recoveryKeyHash, secret);
    if (!valid) {
      for (const code of await findUsableResetCodes(user.id, now)) {
        if (await verifyPassword(code.codeHash, secret)) {
          valid = true;
          usedCodeId = code.id;
          break;
        }
      }
    }
  } else {
    await verifyPassword(await dummyHash(), secret);
  }
  if (!user || !valid) {
    await recordFailure(username, input.address, now);
    return { ok: false, code: "INVALID" };
  }
  if (user.status === "suspended") return { ok: false, code: "SUSPENDED" };

  const recoveryKey = generateRecoveryKey();
  const [passwordHash, recoveryKeyHash] = await Promise.all([hashPassword(input.password), hashPassword(recoveryKey)]);
  const db = await getDb();
  const session = await db.transaction(async (tx) => {
    await updateCredentials(tx, user.id, { passwordHash, recoveryKeyHash });
    if (usedCodeId) await markResetCodeUsed(tx, usedCodeId, now);
    await deleteUserSessions(tx, user.id); // AU-09
    return newSession(tx, user.id, now);
  });
  await track(user.publicId, "user.password_reset");
  await track(user.publicId, "user.login");
  return { ok: true, user, session, recoveryKey };
}

// ---------------------------------------------------------------- sessions

export type ActiveSession = { user: UserRow; tokenHash: string; expiresAt: Date; refreshed: boolean };

/** Loads and checks a session token (AU-08, AU-13). Returns null when invalid, expired or suspended. */
export async function validateSession(token: string | undefined, now = new Date()): Promise<ActiveSession | null> {
  if (!token || token.length < 20) return null;
  const tokenHash = sha256(token);
  const row = await findSessionWithUser(tokenHash);
  if (!row) return null;
  const { session, user } = row;
  if (now >= session.expiresAt || now >= session.absoluteExpiresAt) {
    await deleteSession(tokenHash);
    return null;
  }
  if (user.status !== "active") {
    await deleteUserSessions(null, user.id);
    return null;
  }
  let expiresAt = session.expiresAt;
  let refreshed = false;
  if (now.getTime() - session.lastSeenAt.getTime() >= LIMITS.sessionRefreshMs) {
    expiresAt = new Date(Math.min(now.getTime() + LIMITS.sessionIdleMs, session.absoluteExpiresAt.getTime()));
    await extendSession(tokenHash, now, expiresAt);
    await touchLastActive(user.id, now);
    refreshed = true;
  }
  return { user, tokenHash, expiresAt, refreshed };
}

export async function endSession(token: string | undefined) {
  if (token) await deleteSession(sha256(token));
}
