import { createHash } from "node:crypto";
import { getPrisma } from "../prisma.js";
import { verifyPassword } from "./passwords.js";
import { newSessionToken, safeUser, SESSION_DURATION_MS, sessionTokenHash } from "./sessions.js";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;
export const loginAttemptKey = (email: string, ip: string) =>
  createHash("sha256").update(JSON.stringify([email, ip])).digest("hex");

// Valid local-only bcrypt hash used to do equivalent work for unknown accounts.
const DUMMY_HASH = "$2b$12$yZtMGCcMFWBrvIUUeIrC9.5qEa2BL3hxM6C45LAZGRoJozfzOShAC";

export async function login(email: string, password: string, ip: string, previousToken?: string) {
  const key = loginAttemptKey(email, ip);
  return getPrisma().$transaction(async (tx) => {
    // Serialize attempts for one email/IP across requests and server processes.
    // SELECT's void result is not deserializable by Prisma; select a boolean.
    await tx.$queryRaw`SELECT true FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const now = new Date();
    const record = await tx.loginAttempt.findUnique({ where: { key } });
    const failures = (record?.failures ?? []).filter(date => date.getTime() > now.getTime() - LOGIN_WINDOW_MS);
    if (failures.length >= LOGIN_FAILURE_LIMIT) {
      return { kind: "limited" as const, retryAfter: Math.ceil((failures[0].getTime() + LOGIN_WINDOW_MS - now.getTime()) / 1000) };
    }
    const user = await tx.user.findUnique({ where: { email } });
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid || !user.isActive) {
      failures.push(now);
      await tx.loginAttempt.upsert({ where: { key }, create: { key, failures }, update: { failures } });
      return { kind: "invalid" as const };
    }
    await tx.loginAttempt.deleteMany({ where: { key } });
    if (previousToken) await tx.session.deleteMany({ where: { token: sessionTokenHash(previousToken) } });
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await tx.session.create({ data: { token: sessionTokenHash(token), userId: user.id, expiresAt } });
    return { kind: "success" as const, user: safeUser(user), token, expiresAt };
  }, { maxWait: 15000, timeout: 15000 });
}
