import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import type { User } from "@prisma/client";

export const SESSION_COOKIE = "toktickit_session";
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export const sessionTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const newSessionToken = () => randomBytes(32).toString("hex");

export function cookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" };
}

export function readSessionToken(req: Request): string | undefined {
  const value: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function safeUser(user: User) {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role,
    isActive: user.isActive, mustChangePassword: user.mustChangePassword,
  };
}

export type AuthenticatedUser = ReturnType<typeof safeUser>;
