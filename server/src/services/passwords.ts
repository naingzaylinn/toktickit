import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

// Versioned prehash avoids bcrypt's 72-byte truncation while accepting the
// contract's 72 *characters*, including Unicode. Legacy bcrypt remains readable.
const PREFIX = "bcrypt-sha256$";
const digest = (password: string) => createHash("sha256").update(password, "utf8").digest("base64");

export function passwordValidationError(value: unknown): string | undefined {
  if (typeof value !== "string" || [...value].length < 8 || [...value].length > 72 ||
      !/\p{L}/u.test(value) || !/[0-9]/.test(value)) {
    return "Use 8 to 72 characters, including at least one letter and one number.";
  }
}

export async function hashPassword(password: string): Promise<string> {
  return PREFIX + await bcrypt.hash(digest(password), 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith(PREFIX)) return bcrypt.compare(digest(password), hash.slice(PREFIX.length));
  // Still perform bcrypt work for unknown/legacy accounts when the input is
  // overlong, avoiding an account-format timing shortcut. Never accept a suffix
  // that legacy bcrypt silently truncates.
  const matches = await bcrypt.compare(password, hash);
  return Buffer.byteLength(password, "utf8") <= 72 && matches;
}
