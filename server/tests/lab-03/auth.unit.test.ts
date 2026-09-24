import { describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword, passwordValidationError, verifyPassword } from "../../src/services/passwords.js";

describe("Password storage (UNIT-01 through UNIT-04)", () => {
  it("salts hashes, verifies correct passwords, and rejects incorrect passwords", async () => {
    const password = "LocalTest123";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(await hashPassword(password)).not.toBe(hash);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("Incorrect123", hash)).toBe(false);
  });
  it("can verify the existing bcrypt format", async () => {
    expect(await verifyPassword("Initial123", await bcrypt.hash("Initial123", 10))).toBe(true);
  });
  it("does bcrypt work for overlong legacy input but never accepts a truncated suffix", async () => {
    const password = "a".repeat(71) + "1";
    const hash = await bcrypt.hash(password, 10);
    const compare = vi.spyOn(bcrypt, "compare");
    try {
      expect(await verifyPassword(password + "extra", hash)).toBe(false);
      expect(compare).toHaveBeenCalledOnce();
    } finally {
      compare.mockRestore();
    }
  });
  it.each(["Abcdef1", "a".repeat(72) + "1", "abcdefgh", "12345678", "        ", null, 12345678])("rejects invalid new password %s", value => {
    expect(passwordValidationError(value)).toBeDefined();
  });
  it.each(["Abcdefg1", "a".repeat(71) + "1", "é".repeat(71) + "1"])("accepts the character boundaries", value => {
    expect(passwordValidationError(value)).toBeUndefined();
  });
  it("verifies all Unicode characters without bcrypt truncating the suffix", async () => {
    const password = "é".repeat(70) + "a1";
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("é".repeat(70) + "a2", hash)).toBe(false);
  });
});
