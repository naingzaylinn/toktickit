import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword, verifyPassword } from "../../src/services/passwords.js";
import { login, LOGIN_WINDOW_MS, loginAttemptKey } from "../../src/services/login.js";
import { SESSION_COOKIE, SESSION_DURATION_MS, sessionTokenHash } from "../../src/services/sessions.js";

const prisma = getPrisma();
const initialPassword = "Initial123"; // Local test fixture only.
let user: User;
let passwordHash: string;
const cookieFrom = (res: request.Response) => String(res.headers["set-cookie"][0]).split(";")[0];
const signIn = (password = initialPassword, email = user.email) => request(app).post("/api/auth/login").send({ email, password });
const change = (cookie: string, newPassword = "Changed123", overrides = {}) => request(app)
  .post("/api/auth/change-password").set("Cookie", cookie)
  .send({ currentPassword: initialPassword, newPassword, confirmPassword: newPassword, ...overrides });

beforeAll(async () => { passwordHash = await hashPassword(initialPassword); });
beforeEach(async () => {
  user = await prisma.user.create({ data: { name: "Auth Test", email: `${randomUUID()}@auth.test`, passwordHash } });
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await prisma.user.delete({ where: { id: user.id } });
});

describe("Issue 2 authentication lifecycle", { timeout: 15000 }, () => {
  it("API-01/07: logs in with normalized email and returns only the safe DTO", async () => {
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    const res = await signIn(initialPassword, `  ${user.email.toUpperCase()}  `);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { user: {
      id: user.id, name: user.name, email: user.email, role: "REQUESTER", isActive: true, mustChangePassword: false,
    } } });
    const header = String(res.headers["set-cookie"][0]);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=28800");
    expect(header).toContain("Path=/");
    expect(header).not.toContain("Secure");
    const cookie = cookieFrom(res);
    const token = cookie.split("=")[1];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const session = await prisma.session.findUniqueOrThrow({ where: { token: sessionTokenHash(token) } });
    expect(session.token).not.toBe(token);
    expect(Math.abs(session.expiresAt.getTime() - Date.now() - SESSION_DURATION_MS)).toBeLessThan(3000);
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie).set("X-Development-Requester-Id", randomUUID());
    expect(me.body).toEqual({ data: res.body.data.user });
    expect(me.headers["cache-control"]).toBe("no-store");
  });

  it("uses Secure cookies in production, including when clearing them", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await signIn();
    expect(String(res.headers["set-cookie"])).toContain("Secure");
    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookieFrom(res));
    expect(String(logout.headers["set-cookie"])).toContain("Secure");
  });

  it("API-02/03/04: unknown email, wrong password and inactive accounts fail identically", async () => {
    const wrong = await signIn("Wrong123");
    const unknown = await signIn(initialPassword, `${randomUUID()}@auth.test`);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const inactive = await signIn();
    for (const res of [wrong, unknown, inactive]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { code: "INVALID_CREDENTIALS", message: "Unable to sign in with these credentials." } });
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it.each([{}, { password: initialPassword }, { email: "a@example.com" }, { email: [], password: {} }, { email: "invalid", password: initialPassword }])("API-05/06: validates login input", async body => {
    expect((await request(app).post("/api/auth/login").send(body)).status).toBe(400);
  });

  it("API-08: does not trust client identity without a session", async () => {
    expect((await request(app).get("/api/auth/me").set("X-Development-Requester-Id", user.id)).status).toBe(401);
    expect((await request(app).post("/api/auth/change-password").send({ userId: user.id })).status).toBe(401);
    expect((await request(app).post("/api/auth/logout")).status).toBe(401);
  });

  it("API-09/10: logout deletes the session, clears its cookie, and prevents token replay", async () => {
    const cookie = cookieFrom(await signIn());
    const res = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { message: "Logged out successfully." } });
    expect(String(res.headers["set-cookie"])).toContain(`${SESSION_COOKIE}=;`);
    expect(String(res.headers["set-cookie"])).toContain("Expires=Thu, 01 Jan 1970");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  });

  it("logout invalidates only the requesting session", async () => {
    const first = cookieFrom(await signIn());
    const second = cookieFrom(await signIn());
    expect((await request(app).post("/api/auth/logout").set("Cookie", first)).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Cookie", first)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Cookie", second)).status).toBe(200);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it("API-11/12/16: required change blocks normal operations then preserves the authenticated session", async () => {
    const loginResponse = await signIn();
    expect(loginResponse.body.data.user.mustChangePassword).toBe(true);
    const cookie = cookieFrom(loginResponse);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
    const blocked = await request(app).get("/api/v1/categories").set("Cookie", cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    const sessionBefore = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    const changed = await change(cookie);
    expect(changed.status).toBe(200);
    expect(changed.body).toEqual({ data: { message: "Password changed successfully." } });
    expect(changed.headers["set-cookie"]).toBeUndefined();
    expect(await prisma.session.findUnique({ where: { id: sessionBefore.id } })).toEqual(sessionBefore);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.mustChangePassword).toBe(false);
    expect(updated.passwordHash).not.toBe("Changed123");
    expect(await verifyPassword("Changed123", updated.passwordHash)).toBe(true);
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.mustChangePassword).toBe(false);
    expect((await request(app).get("/api/v1/categories").set("Cookie", cookie)).status).toBe(200);
    expect((await signIn()).status).toBe(401);
    expect((await signIn("Changed123")).status).toBe(200);
  });

  it.each(["Abcdef1", "a".repeat(72) + "1", "abcdefgh", "12345678", "        ", null, 12345678])("API-14: rejects invalid new passwords without modifying credentials", async value => {
    expect((await change(cookieFrom(await signIn()), value as string)).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash).toBe(passwordHash);
  });

  it.each(["Abcdefg1", "a".repeat(71) + "1"])("API-14: accepts exact minimum/maximum length", async value => {
    expect((await change(cookieFrom(await signIn()), value)).status).toBe(200);
    expect((await signIn(value)).status).toBe(200);
  });

  it("API-13/15: rejects mismatched confirmation, missing and incorrect current passwords", async () => {
    const cookie = cookieFrom(await signIn());
    expect((await change(cookie, "Changed123", { confirmPassword: "changed123" })).status).toBe(400);
    expect((await change(cookie, "Changed123", { currentPassword: "" })).status).toBe(400);
    expect((await change(cookie, "Changed123", { currentPassword: "Wrong123" })).status).toBe(401);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(true);
  });

  it("expires sessions at exactly eight hours and rejects invalid or malformed tokens", async () => {
    const cookie = cookieFrom(await signIn());
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(session.expiresAt.getTime() - 1);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
    vi.setSystemTime(session.expiresAt);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    for (const token of ["a".repeat(64), "malformed", "j:%7B%7D"]) {
      expect((await request(app).get("/api/auth/me").set("Cookie", `${SESSION_COOKIE}=${token}`)).status).toBe(401);
    }
  });

  it("rechecks activation/password-change state on every authenticated request", async () => {
    const cookie = cookieFrom(await signIn());
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    expect((await request(app).get("/api/v1/categories").set("Cookie", cookie)).status).toBe(200);
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
    expect((await request(app).get("/api/v1/categories").set("Cookie", cookie)).status).toBe(403);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("issues unpredictable distinct tokens and invalidates a replaced browser session", async () => {
    const first = cookieFrom(await signIn());
    const secondResponse = await request(app).post("/api/auth/login").set("Cookie", first).send({ email: user.email, password: initialPassword });
    const second = cookieFrom(secondResponse);
    expect(second).not.toBe(first);
    expect((await request(app).get("/api/auth/me").set("Cookie", first)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Cookie", second)).status).toBe(200);
  });

  it("API-17: only the sixth attempt is limited; email normalization and spoofed forwarding cannot bypass it", async () => {
    for (let n = 0; n < 5; n++) {
      expect((await signIn("Wrong123", n % 2 ? user.email.toUpperCase() : user.email)).status).toBe(401);
    }
    const limited = await request(app).post("/api/auth/login").set("X-Forwarded-For", "203.0.113.9").send({ email: user.email, password: initialPassword });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(limited.headers["set-cookie"]).toBeUndefined();
    expect((await signIn("Wrong123", `${randomUUID()}@auth.test`)).status).toBe(401);
  });

  it("clears failures after success and isolates client IP addresses", async () => {
    for (let n = 0; n < 4; n++) expect((await login(user.email, "Wrong123", "192.0.2.1")).kind).toBe("invalid");
    expect((await login(user.email, initialPassword, "192.0.2.1")).kind).toBe("success");
    expect(await prisma.loginAttempt.findUnique({ where: { key: loginAttemptKey(user.email, "192.0.2.1") } })).toBeNull();
    for (let n = 0; n < 5; n++) expect((await login(user.email, "Wrong123", "192.0.2.1")).kind).toBe("invalid");
    expect((await login(user.email, initialPassword, "192.0.2.1")).kind).toBe("limited");
    expect((await login(user.email, initialPassword, "192.0.2.2")).kind).toBe("success");
  });

  it("releases the login limit exactly at the sliding 15-minute boundary", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    vi.setSystemTime(start);
    for (let n = 0; n < 5; n++) expect((await signIn("Wrong123")).status).toBe(401);
    vi.setSystemTime(start + LOGIN_WINDOW_MS - 1);
    expect((await signIn()).status).toBe(429);
    vi.setSystemTime(start + LOGIN_WINDOW_MS);
    expect((await signIn()).status).toBe(200);
  });

  it("serializes simultaneous failures so concurrent attempts cannot evade the limit", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => signIn("Wrong123")));
    expect(results.map(result => result.status).sort()).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it("applies the same failure threshold to unknown and inactive accounts", async () => {
    const unknownEmail = `${randomUUID()}@auth.test`;
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    for (const email of [unknownEmail, user.email]) {
      for (let count = 0; count < 5; count++) expect((await signIn(initialPassword, email)).status).toBe(401);
      const response = await signIn(initialPassword, email);
      expect(response.status).toBe(429);
      expect(response.body).toEqual({ error: { code: "TOO_MANY_LOGIN_ATTEMPTS", message: "Too many login attempts. Try again later." } });
    }
  }, 15000);

  it("does not fall through from a restricted or invalid session into legacy operations", async () => {
    const cookie = cookieFrom(await signIn());
    for (const path of ["/api/v1/development-requesters", "/api/v1/tickets", `/api/v1/tickets/${randomUUID()}/attachments/${randomUUID()}`]) {
      const response = await request(app).get(path).set("Cookie", cookie)
        .set("X-Development-Requester-Id", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    }
    for (const invalidCookie of [`${SESSION_COOKIE}=malformed`, `${SESSION_COOKIE}=${"a".repeat(64)}`]) {
      expect((await request(app).get("/api/v1/tickets").set("Cookie", invalidCookie)
        .set("X-Development-Requester-Id", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d")).status).toBe(401);
    }
  });

  it("does not let an authenticated requester select a different legacy requester", async () => {
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    const cookie = cookieFrom(await signIn());
    const otherRequester = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const response = await request(app).get("/api/v1/tickets").set("Cookie", cookie)
      .set("X-Development-Requester-Id", otherRequester);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it("permits only the matching requester header for an authenticated legacy request", async () => {
    await prisma.developmentRequester.create({ data: { id: user.id, name: user.name, email: user.email } });
    try {
      await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
      const cookie = cookieFrom(await signIn());
      expect((await request(app).get("/api/v1/tickets").set("Cookie", cookie)
        .set("X-Development-Requester-Id", user.id)).status).toBe(200);
      // A role change must not leave a staff user acting as a legacy Requester.
      await prisma.user.update({ where: { id: user.id }, data: { role: "IT_STAFF" } });
      expect((await request(app).get("/api/v1/tickets").set("Cookie", cookie)
        .set("X-Development-Requester-Id", user.id)).status).toBe(403);
    } finally {
      await prisma.developmentRequester.delete({ where: { id: user.id } });
    }
  });

  it("returns safe JSON for database failures and malformed JSON", async () => {
    const cookie = cookieFrom(await signIn());
    vi.spyOn(prisma.session, "findUnique").mockRejectedValueOnce(new Error("database credential secret"));
    const failed = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to complete the request." } });
    const malformed = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send('{"password":"sensitive",');
    expect(malformed.status).toBe(400);
    expect(malformed.text).not.toContain("sensitive");
  });

  it("does not permit cross-origin credentialed CORS responses", async () => {
    const response = await request(app).options("/api/auth/login").set("Origin", "https://other.example").set("Access-Control-Request-Method", "POST");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});
