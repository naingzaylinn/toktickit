import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterCookie } from "./sessionFixture.js";

const prisma = getPrisma();
const requesterId = randomUUID(), staffId = randomUUID(), adminId = randomUUID(), inactiveId = randomUUID();
const ticketId = randomUUID();
let requester = "", staff = "", admin = "";
const url = `/api/staff/tickets/${ticketId}`;
beforeAll(async () => {
  await prisma.user.createMany({ data: [
    { id: requesterId, name: "Operations Requester", email: `${requesterId}@test.local`, role: "REQUESTER", passwordHash: "fixture", mustChangePassword: false },
    { id: staffId, name: "Operations Staff", email: `${staffId}@test.local`, role: "IT_STAFF", passwordHash: "fixture", mustChangePassword: false },
    { id: adminId, name: "Operations Admin", email: `${adminId}@test.local`, role: "ADMINISTRATOR", passwordHash: "fixture", mustChangePassword: false },
    { id: inactiveId, name: "Inactive Staff", email: `${inactiveId}@test.local`, role: "IT_STAFF", passwordHash: "fixture", mustChangePassword: false, isActive: false },
  ] });
  [requester, staff, admin] = await Promise.all([requesterCookie(requesterId), requesterCookie(staffId), requesterCookie(adminId)]);
  const category = await prisma.category.findFirstOrThrow();
  const system = await prisma.relatedSystem.findFirstOrThrow();
  await prisma.ticket.create({ data: { id: ticketId, ticketNumber: `OPS-${randomUUID()}`, clientRequestId: randomUUID(), requesterId, categoryId: category.id, relatedSystemId: system.id, summary: "Operations fixture", description: "Private requester description", requestedPriority: "High", itPriority: "High" } });
});
afterAll(async () => {
  await prisma.internalNote.deleteMany({ where: { ticketId } });
  await prisma.publicComment.deleteMany({ where: { ticketId } });
  await prisma.ticket.deleteMany({ where: { id: ticketId } });
  await prisma.session.deleteMany({ where: { userId: { in: [requesterId, staffId, adminId, inactiveId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [requesterId, staffId, adminId, inactiveId] } } });
});
describe("staff ticket operations", () => {
  it("gates detail before existence checks and returns safe DTO", async () => {
    expect((await request(app).get(url)).status).toBe(401);
    expect((await request(app).get(url).set("Cookie", requester)).status).toBe(403);
    const detail = await request(app).get(url).set("Cookie", staff);
    expect(detail.status).toBe(200);
    expect(detail.body.data.requester.name).toBe("Operations Requester");
    expect(JSON.stringify(detail.body)).not.toMatch(/passwordHash|session|loginAttempt/i);
    expect((await request(app).get(url).set("Cookie", admin)).status).toBe(200);
    expect((await request(app).get(`/api/staff/tickets/${randomUUID()}`).set("Cookie", staff)).status).toBe(404);
  });
  it("blocks operations until the mandatory password change is complete", async () => {
    await prisma.user.update({ where: { id: staffId }, data: { mustChangePassword: true } });
    try {
      const detail = await request(app).get(url).set("Cookie", staff);
      const operation = await request(app).patch(url + "/priority").set("Cookie", staff).send({ itPriority: "LOW" });
      expect(detail.status).toBe(403);
      expect(operation.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    } finally {
      await prisma.user.update({ where: { id: staffId }, data: { mustChangePassword: false } });
    }
  });
  it("gates every staff operation before checking ticket or attachment existence", async () => {
    const missing = randomUUID();
    const operations = [
      { method: "get", path: "/api/staff/tickets/owners" },
      { method: "get", path: `/api/staff/tickets/${missing}/notes` },
      { method: "post", path: `/api/staff/tickets/${missing}/notes` },
      { method: "patch", path: `/api/staff/tickets/${missing}/owner` },
      { method: "patch", path: `/api/staff/tickets/${missing}/priority` },
      { method: "patch", path: `/api/staff/tickets/${missing}/status` },
      { method: "get", path: `/api/staff/tickets/${missing}/attachments/${randomUUID()}/download` },
    ] as const;
    for (const operation of operations) {
      const unauthenticated = await request(app)[operation.method](operation.path);
      const forbidden = await request(app)[operation.method](operation.path).set("Cookie", requester);
      expect(unauthenticated.status).toBe(401);
      expect(forbidden.status).toBe(403);
      expect(JSON.stringify(forbidden.body)).not.toContain(missing);
    }
  });
  it("claims, rejects conflicting claim, and validates owners", async () => {
    expect((await request(app).patch(url + "/owner").set("Cookie", staff).send({ ownerId: staffId })).status).toBe(200);
    expect((await request(app).patch(url + "/owner").set("Cookie", staff).send({ ownerId: adminId })).status).toBe(200);
    expect((await request(app).patch(url + "/owner").set("Cookie", staff).send({ ownerId: staffId })).status).toBe(409);
    for (const id of [inactiveId, requesterId, randomUUID()]) expect((await request(app).patch(url + "/owner").set("Cookie", admin).send({ ownerId: id })).status).toBe(400);
    expect((await request(app).patch(url + "/owner").set("Cookie", admin).send({ ownerId: null })).status).toBe(200);
  });
  it("does not let simultaneous claims silently overwrite one another", async () => {
    const results = await Promise.all([
      request(app).patch(url + "/owner").set("Cookie", staff).send({ ownerId: staffId }),
      request(app).patch(url + "/owner").set("Cookie", admin).send({ ownerId: adminId }),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const ownerId = (await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).ownerId;
    expect([staffId, adminId]).toContain(ownerId);
    await prisma.ticket.update({ where: { id: ticketId }, data: { ownerId: null } });
  });
  it("updates IT Priority without changing Requested Priority", async () => {
    expect((await request(app).patch(url + "/priority").set("Cookie", requester).send({ itPriority: "LOW" })).status).toBe(403);
    expect((await request(app).patch(url + "/priority").set("Cookie", staff).send({ itPriority: "INVALID" })).status).toBe(400);
    for (const value of ["LOW", "MEDIUM", "HIGH", "URGENT"] as const) {
      const response = await request(app).patch(url + "/priority").set("Cookie", staff).send({ itPriority: value });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ itPriority: value, requestedPriority: "HIGH" });
      const queue = await request(app).get(`/api/staff/tickets?itPriority=${value}`).set("Cookie", staff);
      expect(queue.body.data.some((ticket: { id: string }) => ticket.id === ticketId)).toBe(true);
    }
    expect((await request(app).patch(url + "/priority").set("Cookie", staff).send({ itPriority: "LOW" })).status).toBe(200);
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect([ticket.itPriority, ticket.requestedPriority]).toEqual(["Low", "High"]);
  });
  it("enforces the documented transition matrix", async () => {
    const matrix: Record<string, string[]> = { NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"], OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"], RESOLVED: ["CLOSED", "REOPENED"], CLOSED: ["REOPENED"], REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], CANCELLED: ["REOPENED"] };
    const db: Record<string, string> = { NEW: "New", OPEN: "Open", IN_PROGRESS: "InProgress", WAITING_FOR_REQUESTER: "WaitingForRequester", RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled" };
    for (const [from, destinations] of Object.entries(matrix)) for (const to of Object.keys(matrix)) {
      await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus: db[from] as never } });
      expect((await request(app).patch(url + "/status").set("Cookie", staff).send({ status: to })).status).toBe(destinations.includes(to) ? 200 : 409);
    }
    await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus: "Closed" } });
    expect((await request(app).patch(url + "/status").set("Cookie", staff).send({ status: "OPEN" })).status).toBe(409);
    expect((await request(app).patch(url + "/status").set("Cookie", staff).send({ status: "BOGUS" })).status).toBe(400);
  });
  it("uses authenticated authors and never exposes notes to requesters", async () => {
    expect((await request(app).post(url + "/notes").set("Cookie", requester).send({ content: "private" })).status).toBe(403);
    expect((await request(app).post(url + "/notes").set("Cookie", staff).send({ content: "   " })).status).toBe(400);
    const note = await request(app).post(url + "/notes").set("Cookie", staff).send({ content: "  private operations note  ", authorId: requesterId });
    expect(note.status).toBe(201);
    expect(note.body.data.author.id).toBe(staffId);
    expect(note.body.data.content).toBe("private operations note");
    expect(note.body.data.createdAt).toBeTruthy();
    expect((await request(app).post(url + "/notes").set("Cookie", staff).send({ content: "x".repeat(2001) })).status).toBe(400);
    const comment = await request(app).post(`/api/tickets/${ticketId}/comments`).set("Cookie", admin).send({ content: " Public reply ", authorId: requesterId });
    expect(comment.status).toBe(201);
    expect(comment.body.data.author.id).toBe(adminId);
    expect(comment.body.data.createdAt).toBeTruthy();
    expect((await request(app).get(url + "/notes").set("Cookie", staff)).body.data).toHaveLength(1);
    expect(JSON.stringify((await request(app).get("/api/staff/tickets").set("Cookie", staff)).body)).not.toContain("private operations note");
    expect(JSON.stringify((await request(app).get(`/api/tickets/${ticketId}/comments`).set("Cookie", requester)).body)).not.toContain("private operations note");
    expect(JSON.stringify((await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", requester)).body)).not.toContain("private operations note");
    expect(JSON.stringify((await request(app).get("/api/tickets").set("Cookie", requester)).body)).not.toContain("private operations note");
  });
});
