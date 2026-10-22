/**
 * File storage (BRD section 9). Production: UploadThing with private ACL; every read is a 5-minute
 * signed URL created here (UP-04). "local" keeps files under .data/uploads for tests and offline work:
 * its signed URLs point at /api/dev-files and are HMAC-signed with APP_SECRET.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { UTApi } from "uploadthing/server";
import { appSecret } from "@/lib/auth/crypto";

export const SIGNED_URL_SECONDS = 300;

export type Storage = {
  driver: "uploadthing" | "local" | "test";
  signedUrl(key: string, seconds?: number): Promise<{ url: string; expiresAt: Date }>;
  read(key: string): Promise<Uint8Array>;
  /** Throws when the storage service refuses; keys that no longer exist count as deleted. */
  deleteKeys(keys: string[]): Promise<void>;
};

let override: Storage | null = null;
/** Tests: replace the storage (for example to record deletions). */
export function setStorageOverride(s: Storage | null) {
  override = s;
}

let ut: UTApi | null = null;
function utapi() {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) throw new Error("Missing environment variable UPLOADTHING_TOKEN");
  return (ut ??= new UTApi({ token }));
}

const uploadThing: Storage = {
  driver: "uploadthing",
  async signedUrl(key, seconds = SIGNED_URL_SECONDS) {
    const { ufsUrl } = await utapi().generateSignedURL(key, { expiresIn: seconds });
    return { url: ufsUrl, expiresAt: new Date(Date.now() + seconds * 1000) };
  },
  async read(key) {
    const { url } = await this.signedUrl(key);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`File download failed (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  },
  async deleteKeys(keys) {
    if (!keys.length) return;
    const r = await utapi().deleteFiles(keys);
    if (!r.success) throw new Error("UploadThing refused the deletion");
  },
};

// ------------------------------------------------------------------ local driver

export const localDir = () => path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_LOCAL_DIR || path.join(process.cwd(), ".data/uploads"));
const safeKey = (key: string) => {
  if (!/^[A-Za-z0-9._-]{8,200}$/.test(key)) throw new Error("Bad file key");
  return key;
};
const localSig = (key: string, exp: number) => createHmac("sha256", appSecret()).update(`dev-file:${key}:${exp}`).digest("base64url");

export function verifyLocalSignature(key: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const a = Buffer.from(localSig(key, exp));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function writeLocalFile(key: string, bytes: Uint8Array) {
  await mkdir(localDir(), { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ localDir(), safeKey(key)), bytes);
}

const local: Storage = {
  driver: "local",
  async signedUrl(key, seconds = SIGNED_URL_SECONDS) {
    const exp = Math.floor(Date.now() / 1000) + seconds;
    const origin = (process.env.APP_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
    return { url: `${origin}/api/dev-files/${encodeURIComponent(safeKey(key))}?e=${exp}&s=${localSig(key, exp)}`, expiresAt: new Date(exp * 1000) };
  },
  async read(key) {
    return new Uint8Array(await readFile(path.join(/*turbopackIgnore: true*/ localDir(), safeKey(key))));
  },
  async deleteKeys(keys) {
    await Promise.all(keys.map((k) => rm(path.join(/*turbopackIgnore: true*/ localDir(), safeKey(k)), { force: true })));
  },
};

export function storage(): Storage {
  if (override) return override;
  return driverName() === "local" ? local : uploadThing;
}

const driverName = () => (process.env.UPLOAD_DRIVER === "local" ? "local" : "uploadthing");
export const uploadDriver = () => (override ? "local" : driverName());
