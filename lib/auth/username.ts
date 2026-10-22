/** AU-01: 3 to 30 characters; letters, numbers, dot and underscore; case-insensitive; reserved names refused. */
export const USERNAME_PATTERN = /^[A-Za-z0-9._]{3,30}$/;
export const RESERVED_USERNAMES = ["admin", "grid", "support", "root", "system"];

export type UsernameCheck = { ok: true; value: string } | { ok: false; reason: string };

export function checkUsername(raw: string): UsernameCheck {
  const value = raw.trim();
  if (value.length < 3 || value.length > 30) return { ok: false, reason: "Use 3 to 30 characters." };
  if (!USERNAME_PATTERN.test(value))
    return { ok: false, reason: "Use only letters, numbers, dots and underscores." };
  if (RESERVED_USERNAMES.includes(value.toLowerCase())) return { ok: false, reason: "That username is reserved. Try another." };
  return { ok: true, value };
}
