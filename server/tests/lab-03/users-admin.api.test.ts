import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword, verifyPassword } from "../../src/services/passwords.js";
import { requesterCookie } from "./sessionFixture.js";

const prisma = getPrisma();
const ids: string[] = [];
const address = () => `${randomUUID()}@admin.test`;
let admin: string, otherAdmin: string, requester: string, staff: string;
let adminCookie: string, requesterSession: string, staffSession: string, changeSession: string;
async function fixture(role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", active = true) {
  const user = await prisma.user.create({ data: { name: `Fixture ${role}`, email: address(), role, isActive: active, passwordHash: await hashPassword("Initial123"), mustChangePassword: false } });
  ids.push(user.id);
  return user;
}
beforeAll(async () => {
  admin = (await fixture("ADMINISTRATOR")).id;
  otherAdmin = (await fixture("ADMINISTRATOR")).id;
  requester = (await fixture("REQUESTER")).id;
  staff = (await fixture("IT_STAFF")).id;
  adminCookie = await requesterCookie(admin);
  requesterSession = await requesterCookie(requester);
  staffSession = await requesterCookie(staff);
  changeSession = await requesterCookie(otherAdmin);
  await prisma.user.update({ where: { id: otherAdmin }, data: { mustChangePassword: true } });
});
afterAll(async () => { await prisma.session.deleteMany({ where: { userId: { in: ids } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } }); });
const users = () => request(app).get("/api/admin/users");

describe("Administrator User Management", () => {
  it("enforces authentication, password change, and Administrator role", async () => {
    expect((await users()).status).toBe(401);
    expect((await users().set("Cookie", changeSession)).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect((await users().set("Cookie", requesterSession)).status).toBe(403);
    expect((await users().set("Cookie", staffSession)).status).toBe(403);
    expect((await users().set("Cookie", adminCookie)).status).toBe(200);
  });
  it("enforces the same gate on every mutation before looking up a target", async () => {
    const paths = [
      { method: "post" as const, path: "/api/admin/users", body: { name: "Test", email: address(), role: "REQUESTER", isActive: true, initialPassword: "Initial123" } },
      { method: "patch" as const, path: `/api/admin/users/${randomUUID()}`, body: { name: "Test" } },
      { method: "post" as const, path: `/api/admin/users/${randomUUID()}/initial-password`, body: { initialPassword: "Initial123" } },
    ];
    for (const { method, path, body } of paths) {
      expect((await request(app)[method](path).send(body)).status).toBe(401);
      expect((await request(app)[method](path).set("Cookie", changeSession).send(body)).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
      expect((await request(app)[method](path).set("Cookie", requesterSession).set("X-Role", "ADMINISTRATOR").send(body)).status).toBe(403);
      expect((await request(app)[method](path).set("Cookie", staffSession).send(body)).status).toBe(403);
    }
  });
  it("lists safe fields and applies server-side search and role filtering", async () => {
    const response = await users().set("Cookie", adminCookie).query({ search: "fixture", role: "IT_STAFF" });
    expect(response.status).toBe(200);
    expect(response.body.data.some((u: {id: string}) => u.id === staff)).toBe(true);
    expect(response.body.data.every((u: {role: string}) => u.role === "IT_STAFF")).toBe(true);
    for (const user of response.body.data) expect(Object.keys(user).sort()).toEqual(["email", "id", "isActive", "mustChangePassword", "name", "role"]);
    expect((await users().set("Cookie", adminCookie).query({ role: "INVALID" })).status).toBe(400);
    const emailSearch = await users().set("Cookie", adminCookie).query({ search: (await prisma.user.findUniqueOrThrow({ where: { id: staff } })).email.toUpperCase() });
    expect(emailSearch.body.data.map((user: { id: string }) => user.id)).toContain(staff);
  });
  it("creates all roles with normalized unique email and a hashed initial password", async () => {
    for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]) {
      const email = address();
      const response = await request(app).post("/api/admin/users").set("Cookie", adminCookie).send({ name: "New User", email: email.toUpperCase(), role, isActive: true, initialPassword: "Initial123" });
      expect(response.status).toBe(201);
      ids.push(response.body.data.id);
      expect(response.body.data).toMatchObject({ email, role, mustChangePassword: true });
      expect(response.body.data).not.toHaveProperty("passwordHash");
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: response.body.data.id } });
      expect(stored.passwordHash).not.toBe("Initial123");
      expect(await verifyPassword("Initial123", stored.passwordHash)).toBe(true);
      expect((await request(app).post("/api/admin/users").set("Cookie", adminCookie).send({ name: "Duplicate", email, role, isActive: true, initialPassword: "Initial123" })).status).toBe(409);
    }
  }, 15000);
  it("rejects invalid and mass-assignment input", async () => {
    for (const patch of [{}, { role: "BAD" }, { name: "" }, { email: "bad" }, { passwordHash: "plaintext" }, { mustChangePassword: false }, { id: randomUUID() }, { sessions: [] }, { createdAt: new Date().toISOString() }]) {
      expect((await request(app).patch(`/api/admin/users/${requester}`).set("Cookie", adminCookie).send(patch)).status).toBe(400);
    }
    expect((await request(app).post("/api/admin/users").set("Cookie", adminCookie).send({ name: "New", email: address(), role: "REQUESTER", isActive: true, initialPassword: "Initial123", mustChangePassword: false })).status).toBe(400);
    for (const password of ["short1A", "OnlyLetters", "12345678", "A".repeat(72) + "1"]) {
      expect((await request(app).post("/api/admin/users").set("Cookie", adminCookie).send({ name: "New", email: address(), role: "REQUESTER", isActive: true, initialPassword: password })).status).toBe(400);
    }
  });
  it("updates permitted fields, deactivates sessions, and preserves user records", async () => {
    const email = address();
    const changed = await request(app).patch(`/api/admin/users/${requester}`).set("Cookie", adminCookie).send({ name: "Changed", email, role: "IT_STAFF", isActive: false });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ name: "Changed", email, role: "IT_STAFF", isActive: false });
    expect(Object.keys(changed.body.data).sort()).toEqual(["email", "id", "isActive", "mustChangePassword", "name", "role"]);
    expect((await users().set("Cookie", requesterSession)).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: "Initial123" })).status).toBe(401);
    expect((await request(app).patch(`/api/admin/users/${requester}`).set("Cookie", adminCookie).send({ isActive: true })).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: requester } })).toBeTruthy();
  });
  it("guards self-deactivation, last active Administrator, and missing users", async () => {
    expect((await request(app).patch(`/api/admin/users/${admin}`).set("Cookie", adminCookie).send({ isActive: false })).status).toBe(409);
    expect((await request(app).patch(`/api/admin/users/${randomUUID()}`).set("Cookie", adminCookie).send({ name: "Missing" })).status).toBe(404);
    expect((await request(app).post(`/api/admin/users/${randomUUID()}/initial-password`).set("Cookie", adminCookie).send({ initialPassword: "Initial123" })).status).toBe(404);
    // Other fixture Administrator has a pending password change but remains active.
    expect((await request(app).patch(`/api/admin/users/${otherAdmin}`).set("Cookie", adminCookie).send({ isActive: false })).status).toBe(200);
  });
  it("sets a new initial password and immediately restricts existing sessions", async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: staff } });
    expect((await request(app).post(`/api/admin/users/${staff}/initial-password`).set("Cookie", adminCookie).send({ initialPassword: "bad" })).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff } })).passwordHash).toBe(before.passwordHash);
    const response = await request(app).post(`/api/admin/users/${staff}/initial-password`).set("Cookie", adminCookie).send({ initialPassword: "ResetPass123" });
    expect(response.status).toBe(200);
    expect(response.body.data.mustChangePassword).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("ResetPass123");
    expect((await users().set("Cookie", staffSession)).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: staff } });
    expect(await verifyPassword("ResetPass123", stored.passwordHash)).toBe(true);
    expect((await request(app).post("/api/auth/change-password").set("Cookie", staffSession).send({ currentPassword: "ResetPass123", newPassword: "Changed123", confirmPassword: "Changed123" })).status).toBe(200);
    expect((await request(app).get("/api/staff/tickets").set("Cookie", staffSession)).status).toBe(200);
  });
  it("protects the last active Administrator", async () => {
    // This test runs only in the fresh isolated schema; seed includes an Administrator.
    await prisma.user.updateMany({ where: { role: "ADMINISTRATOR", id: { not: admin } }, data: { isActive: false } });
    expect((await request(app).patch(`/api/admin/users/${admin}`).set("Cookie", adminCookie).send({ role: "IT_STAFF" })).status).toBe(409);
    await prisma.user.update({ where: { id: otherAdmin }, data: { isActive: true, mustChangePassword: false } });
    const competingSession = await requesterCookie(otherAdmin);
    const outcomes = await Promise.all([
      request(app).patch(`/api/admin/users/${admin}`).set("Cookie", adminCookie).send({ role: "REQUESTER" }),
      request(app).patch(`/api/admin/users/${otherAdmin}`).set("Cookie", competingSession).send({ isActive: false }),
    ]);
    expect(outcomes.map(outcome => outcome.status).sort()).toEqual([200, 409]);
    expect(await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBe(1);
  });
});
