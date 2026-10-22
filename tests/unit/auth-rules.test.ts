import { describe, expect, it } from "vitest";
import { checkPassword, hashPassword, verifyPassword } from "@/lib/auth/password";
import { checkUsername } from "@/lib/auth/username";
import { formatRecoveryKey, generatePublicId, generateRecoveryKey, normalizeRecoveryKey, PUBLIC_ID_PATTERN } from "@/lib/auth/ids";
import { safeNext } from "@/lib/auth/redirects";
import { seal, unseal } from "@/lib/auth/crypto";

process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";

describe("passwords (AU-02, AU-03)", () => {
  it("AC-008: refuses 12 characters", () => {
    const r = checkPassword("abcdefghijkl");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/at least 15/);
  });
  it("accepts a 16-character phrase with spaces and any characters", () => {
    expect(checkPassword("mango lamp river 7").ok).toBe(true);
    expect(checkPassword("ñandú café señor!").ok).toBe(true);
  });
  it("AC-009: refuses passwordpassword as too common", () => {
    const r = checkPassword("passwordpassword");
    expect(!r.ok && r.reason).toMatch(/too common/);
  });
  it("refuses repeated, sequential and listed passwords", () => {
    expect(checkPassword("aaaaaaaaaaaaaaaa").ok).toBe(false);
    expect(checkPassword("abcabcabcabcabcabc").ok).toBe(false);
    expect(checkPassword("1234567890123456").ok).toBe(false);
    expect(checkPassword("000000000000000").ok).toBe(false);
  });
  it("refuses a password containing the username", () => {
    const r = checkPassword("my name is maria.santos ok", "Maria.Santos");
    expect(!r.ok && r.reason).toMatch(/username/);
  });
  it("refuses more than 128 characters", () => {
    expect(checkPassword("x y ".repeat(40)).ok).toBe(false);
  });
  it("AU-04: hashes with Argon2id m=19456 t=2 p=1 and verifies", async () => {
    const h = await hashPassword("mango lamp river 7");
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(h, "mango lamp river 7")).toBe(true);
    expect(await verifyPassword(h, "mango lamp river 8")).toBe(false);
  });
});

describe("usernames (AU-01)", () => {
  it("AC-010: refuses Admin as reserved", () => {
    const r = checkUsername("Admin");
    expect(!r.ok && r.reason).toMatch(/reserved/);
  });
  it("allows letters, numbers, dot and underscore, 3 to 30", () => {
    expect(checkUsername("maria.santos_88").ok).toBe(true);
    expect(checkUsername("ab").ok).toBe(false);
    expect(checkUsername("a".repeat(31)).ok).toBe(false);
    expect(checkUsername("maria santos").ok).toBe(false);
    expect(checkUsername("maria@grid").ok).toBe(false);
  });
});

describe("IDs and keys (AU-05, AU-06)", () => {
  it("User IDs are U- plus 6 Crockford characters", () => {
    for (let i = 0; i < 200; i++) expect(generatePublicId()).toMatch(PUBLIC_ID_PATTERN);
  });
  it("recovery keys are 20 characters in five groups of four", () => {
    const k = generateRecoveryKey();
    expect(k).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/);
    expect(formatRecoveryKey(k)).toMatch(/^([0-9A-Z]{4}-){4}[0-9A-Z]{4}$/);
  });
  it("normalises what people type", () => {
    expect(normalizeRecoveryKey("abcd-efgh ijkm-nOpq-rstv")).toBe("ABCDEFGH1JKMN0PQRSTV");
  });
});

describe("redirects and flash", () => {
  it("only allows same-site paths after login", () => {
    expect(safeNext("/app/reports", "/app")).toBe("/app/reports");
    expect(safeNext("//evil.example", "/app")).toBe("/app");
    expect(safeNext("https://evil.example", "/app")).toBe("/app");
    expect(safeNext("/login", "/app")).toBe("/app");
  });
  it("sealed flash data round-trips and rejects tampering", () => {
    const t = seal({ a: 1 });
    expect(unseal(t)).toEqual({ a: 1 });
    expect(unseal(t.slice(0, -2) + "xx")).toBeNull();
  });
});
