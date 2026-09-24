import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/services/passwords.js";

const prisma = getPrisma();
const ids: string[] = [];
const ticketIds: string[] = [];
const initial = "Initial123";
const cookie = (response: request.Response) => String(response.headers["set-cookie"][0]).split(";")[0];
const login = (email: string, password = initial) => request(app).post("/api/auth/login").send({ email, password });
let adminEmail: string, otherEmail: string, staffEmail: string;
let staffId: string, otherId: string;

beforeAll(async () => {
  const passwordHash = await hashPassword(initial);
  async function user(role: "ADMINISTRATOR" | "IT_STAFF" | "REQUESTER", name: string) {
    const email = `${randomUUID()}@workflow.test`;
    const record = await prisma.user.create({ data: { name, email, role, passwordHash, mustChangePassword: false } });
    ids.push(record.id);
    return record;
  }
  ({ email: adminEmail } = await user("ADMINISTRATOR", "Workflow Admin"));
  ({ id: otherId, email: otherEmail } = await user("REQUESTER", "Other Requester"));
  ({ id: staffId, email: staffEmail } = await user("IT_STAFF", "Workflow Staff"));
});

afterAll(async () => {
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.ticketEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("cross-role API journeys in the disposable schema", { timeout: 30000 }, () => {
  it("connects administrator provisioning, requester work, staff handling, and account revocation", async () => {
    const admin = cookie(await login(adminEmail));
    const createdEmail = `${randomUUID()}@workflow.test`;
    const created = await request(app).post("/api/admin/users").set("Cookie", admin).send({ name: "New Requester", email: createdEmail, role: "REQUESTER", isActive: true, initialPassword: initial });
    expect(created.status).toBe(201);
    ids.push(created.body.data.id);
    expect(JSON.stringify(created.body)).not.toMatch(/passwordHash|Initial123|session/i);
    const found = await request(app).get("/api/admin/users").set("Cookie", admin).query({ search: createdEmail, role: "REQUESTER" });
    expect(found.body.data.map((user: { id: string }) => user.id)).toContain(created.body.data.id);

    const firstLogin = await login(createdEmail);
    expect(firstLogin.status).toBe(200);
    const newRequester = cookie(firstLogin);
    expect((await request(app).get("/api/tickets").set("Cookie", newRequester)).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect((await request(app).post("/api/auth/change-password").set("Cookie", newRequester).send({ currentPassword: initial, newPassword: "Changed123", confirmPassword: "Changed123" })).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Cookie", newRequester)).body.data.role).toBe("REQUESTER");

    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    const createdTicket = await request(app).post("/api/tickets").set("Cookie", newRequester).send({ categoryId: category.id, relatedSystemId: system.id, requestedPriority: "Medium", summary: "Workflow ticket", description: "Cross-role verification", clientRequestId: randomUUID(), requesterId: otherId });
    expect(createdTicket.status).toBe(201);
    const ticketId = createdTicket.body.data.id as string;
    ticketIds.push(ticketId);
    expect(createdTicket.body.data.requesterId).toBe(created.body.data.id);
    expect((await request(app).get("/api/tickets").set("Cookie", newRequester)).body.data.some((ticket: { id: string }) => ticket.id === ticketId)).toBe(true);
    const other = cookie(await login(otherEmail));
    expect((await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", other)).status).toBe(404);
    expect((await request(app).patch(`/api/staff/tickets/${ticketId}/status`).set("Cookie", newRequester).send({ status: "RESOLVED" })).status).toBe(403);

    const staff = cookie(await login(staffEmail));
    expect((await request(app).get("/api/admin/users").set("Cookie", staff)).status).toBe(403);
    const queue = await request(app).get("/api/staff/tickets").set("Cookie", staff).query({ search: createdTicket.body.data.ticketNumber, status: "NEW" });
    expect(queue.status).toBe(200);
    expect(queue.body.data.some((ticket: { id: string }) => ticket.id === ticketId)).toBe(true);
    expect((await request(app).get(`/api/staff/tickets/${ticketId}`).set("Cookie", staff)).status).toBe(200);
    expect((await request(app).patch(`/api/staff/tickets/${ticketId}/owner`).set("Cookie", staff).send({ ownerId: staffId })).status).toBe(200);
    expect((await request(app).patch(`/api/staff/tickets/${ticketId}/priority`).set("Cookie", staff).send({ itPriority: "URGENT" })).body.data).toMatchObject({ requestedPriority: "MEDIUM", itPriority: "URGENT" });
    expect((await request(app).patch(`/api/staff/tickets/${ticketId}/status`).set("Cookie", staff).send({ status: "OPEN" })).status).toBe(200);
    expect((await request(app).patch(`/api/staff/tickets/${ticketId}/status`).set("Cookie", staff).send({ status: "CLOSED" })).status).toBe(409);
    const comment = await request(app).post(`/api/tickets/${ticketId}/comments`).set("Cookie", staff).send({ content: "We are investigating." });
    expect(comment.status).toBe(201);
    expect((await request(app).get(`/api/tickets/${ticketId}/comments`).set("Cookie", newRequester)).body.data.some((item: { id: string }) => item.id === comment.body.data.id)).toBe(true);
    expect((await request(app).post(`/api/staff/tickets/${ticketId}/notes`).set("Cookie", staff).send({ content: "Private workflow note" })).status).toBe(201);
    expect((await request(app).get(`/api/staff/tickets/${ticketId}/notes`).set("Cookie", newRequester)).status).toBe(403);
    expect(JSON.stringify((await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", newRequester)).body)).not.toContain("Private workflow note");
    expect((await request(app).post(`/api/tickets/${ticketId}/problem-appears-resolved`).set("Cookie", newRequester)).status).toBe(200);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).currentStatus).toBe("Open");

    expect((await request(app).patch(`/api/admin/users/${created.body.data.id}`).set("Cookie", admin).send({ name: "Updated Requester" })).body.data.name).toBe("Updated Requester");
    expect((await request(app).post(`/api/admin/users/${created.body.data.id}/initial-password`).set("Cookie", admin).send({ initialPassword: "ResetPass123" })).status).toBe(200);
    expect((await request(app).get("/api/tickets").set("Cookie", newRequester)).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect((await request(app).post("/api/auth/change-password").set("Cookie", newRequester).send({ currentPassword: "ResetPass123", newPassword: "FinalPass123", confirmPassword: "FinalPass123" })).status).toBe(200);
    expect((await request(app).patch(`/api/admin/users/${created.body.data.id}`).set("Cookie", admin).send({ isActive: false })).status).toBe(200);
    expect((await request(app).get("/api/tickets").set("Cookie", newRequester)).status).toBe(401);
    expect((await login(createdEmail, "FinalPass123")).status).toBe(401);
    expect((await request(app).post("/api/auth/logout").set("Cookie", staff)).status).toBe(200);
    expect((await request(app).get("/api/staff/tickets").set("Cookie", staff)).status).toBe(401);
  });
});
