import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/services/passwords.js";
import { requireAuthentication, requirePasswordChanged } from "../../src/middleware/authentication.js";

// Issue 2 tests the reusable middleware. Full requester/role authorization is
// deliberately left to Issue 3; this harness is not a new production endpoint.
const protectedApp = express();
protectedApp.use(cookieParser());
protectedApp.get("/protected", requireAuthentication, requirePasswordChanged, (req, res) => res.json({ data: req.auth!.user }));
const prisma = getPrisma();
let id: string;
let cookie: string;
beforeAll(async () => {
  const user = await prisma.user.create({ data: { name: "Restricted Test", email: `${randomUUID()}@auth.test`, passwordHash: await hashPassword("Initial123") } });
  id = user.id;
  const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "Initial123" });
  expect(login.status).toBe(200);
  cookie = String(login.headers["set-cookie"][0]).split(";")[0];
});
afterAll(async () => { if (id) await prisma.user.delete({ where: { id } }); });

describe("Issue 2 authentication middleware", () => {
  it("requires server authentication, regardless of client identity headers", async () => {
    expect((await request(protectedApp).get("/protected").set("X-Development-Requester-Id", id)).status).toBe(401);
  });
  it("API-16: blocks normal protected access until password change succeeds", async () => {
    const blocked = await request(protectedApp).get("/protected").set("Cookie", cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect((await request(app).post("/api/auth/change-password").set("Cookie", cookie).send({ currentPassword: "Initial123", newPassword: "Changed123", confirmPassword: "Changed123" })).status).toBe(200);
    const allowed = await request(protectedApp).get("/protected").set("Cookie", cookie).set("X-Development-Requester-Id", randomUUID());
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.id).toBe(id);
    expect(allowed.body.data).not.toHaveProperty("passwordHash");
  });
});
