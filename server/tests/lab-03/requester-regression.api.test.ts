import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterCookie } from "./sessionFixture.js";
const prisma = getPrisma();
const alice = randomUUID(), bob = randomUUID(), staff = randomUUID(), admin = randomUUID();
let cookie: string, bobCookie: string, staffCookie: string, adminCookie: string, ticketId: string, foreignId: string, categoryId: number, systemId: string;
beforeAll(async () => {
    for (const [id, role] of [[alice, "REQUESTER"], [bob, "REQUESTER"], [staff, "IT_STAFF"], [admin, "ADMINISTRATOR"]] as const)
        await prisma.user.create({ data: { id, name: role + id, email: id + "@issue34.test", role, passwordHash: "fixture-not-a-password", mustChangePassword: false } });
    [cookie, bobCookie, staffCookie, adminCookie] = await Promise.all([alice, bob, staff, admin].map(requesterCookie));
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
    systemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
    ticketId = (await request(app).post("/api/tickets").set("Cookie", cookie).send(payload())).body.data.id;
    foreignId = (await request(app).post("/api/tickets").set("Cookie", bobCookie).send(payload())).body.data.id;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await prisma.publicComment.deleteMany({ where: { authorId: { in: [alice, bob, staff, admin] } } }); await prisma.ticket.deleteMany({ where: { requesterId: { in: [alice, bob] } } }); await prisma.user.deleteMany({ where: { id: { in: [alice, bob, staff, admin] } } }); });
function payload() { return { categoryId, relatedSystemId: systemId, summary: "Requester regression ticket", description: "Preserve authenticated requester workflow.", requestedPriority: "High", clientRequestId: randomUUID() }; }
describe("Issue #34 authorization and requester regression", () => {
    it.each(["/api/tickets", "/api/v1/tickets", "/api/v1/categories", "/api/v1/related-systems"])("AUTH-01: %s requires a session", async (path) => { expect((await request(app).get(path).set("X-Development-Requester-Id", alice)).status).toBe(401); });
    it("AUTH-07 REG-01: ignores forged identity, role, status and IT Priority when creating", async () => {
        const result = await request(app).post("/api/tickets?requesterId=" + bob).set("Cookie", cookie).set("X-Development-Requester-Id", bob).set("X-Role", "ADMINISTRATOR").send({ ...payload(), requesterId: bob, role: "ADMINISTRATOR", currentStatus: "CLOSED", status: "RESOLVED", itPriority: "Low" });
        expect(result.status).toBe(201);
        expect(result.body.data.requesterId).toBe(alice);
        const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: result.body.data.id } });
        expect(saved.currentStatus).toBe("New");
        expect(saved.itPriority).toBe("High");
    });
    it("REG-02/03 AUTH-08: lists only owned tickets and safely hides other tickets on both URL families", async () => {
        for (const base of ["/api/tickets", "/api/v1/tickets"]) {
            const own = await request(app).get(base + "?requesterId=" + bob).set("Cookie", cookie).set("X-Development-Requester-Id", bob);
            expect(own.status).toBe(200);
            expect(own.body.data.some((t: {
                id: string;
            }) => t.id === ticketId)).toBe(true);
            expect(own.body.data.some((t: {
                id: string;
            }) => t.id === foreignId)).toBe(false);
            expect((await request(app).get(base + "/" + ticketId).set("Cookie", cookie)).status).toBe(200);
            const other = await request(app).get(base + "/" + foreignId).set("Cookie", cookie);
            const missing = await request(app).get(base + "/" + randomUUID()).set("Cookie", cookie);
            expect(other.status).toBe(404);
            expect(other.body.error.code).toBe(missing.body.error.code);
            expect(other.body).not.toHaveProperty("data");
        }
    });
    it.each(["/api/staff/tickets", "/api/admin/users"])("AUTH-02/05: Requester cannot access %s", async (path) => { expect((await request(app).get(path).set("Cookie", cookie).set("X-Role", "ADMINISTRATOR")).status).toBe(403); });
    it("AUTH-04: Staff cannot access Administrator APIs", async () => { expect((await request(app).get("/api/admin/users").set("Cookie", staffCookie)).status).toBe(403); });
    it("role foundations admit permitted Staff and Administrator operations", async () => {
    expect(
        (await request(app).get("/api/staff/tickets").set("Cookie", staffCookie)).status
    ).toBe(200);

    expect(
        (await request(app).get("/api/staff/tickets").set("Cookie", adminCookie)).status
    ).toBe(200);

    expect(
        (await request(app).get("/api/admin/users").set("Cookie", adminCookie)).status
    ).toBe(200);
});
    it("Staff and Administrator cannot inherit requester operations via forged identity", async () => { for (const session of [staffCookie, adminCookie]) {
        for (const path of ["/api/tickets", "/api/v1/tickets"]) {
            expect((await request(app).get(path).set("Cookie", session).set("X-Development-Requester-Id", alice)).status).toBe(403);
            expect((await request(app).post(path).set("Cookie", session).send({ ...payload(), requesterId: alice, role: "REQUESTER" })).status).toBe(403);
        }
        expect((await request(app).post("/api/tickets/" + ticketId + "/problem-appears-resolved").set("Cookie", session)).status).toBe(403);
    } });
    it("AUTH-03 NOTE-03/04: note read/write is forbidden, with no private content", async () => { for (const method of ["get", "post"] as const) {
        const result = await request(app)[method]("/api/staff/tickets/" + ticketId + "/notes").set("Cookie", cookie).send({ content: "private marker" });
        expect(result.status).toBe(403);
        expect(result.text).not.toContain("private marker");
        expect(result.body).not.toHaveProperty("data");
    } });
    it("DETAIL-05/07/10: direct staff ownership, priority, Resolve and Close attempts fail", async () => { for (const [action, body] of [["status", { status: "RESOLVED" }], ["status", { status: "CLOSED" }], ["owner", { ownerId: alice }], ["priority", { itPriority: "Urgent" }]] as const) {
        expect((await request(app).patch("/api/staff/tickets/" + ticketId + "/" + action).set("Cookie", cookie).send(body)).status).toBe(403);
    } expect((await request(app).patch("/api/tickets/" + ticketId).set("Cookie", cookie).send({ status: "CLOSED" })).status).toBe(404); expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).currentStatus).toBe("New"); });
    it("API-16: password-change, role, inactive state and logout remain authoritative", async () => {
        const fresh = await requesterCookie(alice);
        await prisma.user.update({ where: { id: alice }, data: { mustChangePassword: true } });
        expect((await request(app).get("/api/tickets").set("Cookie", fresh)).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
        await prisma.user.update({ where: { id: alice }, data: { mustChangePassword: false, role: "IT_STAFF" } });
        expect((await request(app).get("/api/tickets").set("Cookie", fresh).set("X-Role", "REQUESTER")).status).toBe(403);
        await prisma.user.update({ where: { id: alice }, data: { role: "REQUESTER", isActive: false } });
        expect((await request(app).get("/api/tickets").set("Cookie", fresh)).status).toBe(401);
        await prisma.user.update({ where: { id: alice }, data: { isActive: true } });
        const logoutCookie = await requesterCookie(alice);
        expect((await request(app).post("/api/auth/logout").set("Cookie", logoutCookie)).status).toBe(200);
        expect((await request(app).get("/api/tickets").set("Cookie", logoutCookie)).status).toBe(401);
    });
    it("COMMENT-01/05/06: public DTO uses server author/time and trims text", async () => {
        const result = await request(app).post("/api/tickets/" + ticketId + "/comments").set("Cookie", cookie).send({ content: "  <script>alert(1)</script>  ", authorId: bob, createdAt: "2000-01-01", internalNotes: "private marker" });
        expect(result.status).toBe(201);
        expect(result.body.data.content).toBe("<script>alert(1)</script>");
        expect(result.body.data.author.id).toBe(alice);
        expect(new Date(result.body.data.createdAt).getFullYear()).toBe(new Date().getFullYear());
        expect(Object.keys(result.body.data).sort()).toEqual(["id", "ticketId", "content", "author", "createdAt"].sort());
        expect(result.text).not.toMatch(/passwordHash|private marker|internalNotes/);
        const list = await request(app).get("/api/tickets/" + ticketId + "/comments").set("Cookie", cookie);
        expect(list.status).toBe(200);
        expect(list.body.data).toContainEqual(result.body.data);
    });
    it.each(["", "   ", "x".repeat(2001), null, 123])("COMMENT-03/04: rejects invalid content %s", async (content) => { expect((await request(app).post("/api/tickets/" + ticketId + "/comments").set("Cookie", cookie).send({ content })).status).toBe(400); });
    it("accepts 2000 characters after trimming and preserves creation order", async () => { const result = await request(app).post("/api/tickets/" + ticketId + "/comments").set("Cookie", cookie).send({ content: "  " + "x".repeat(2000) + "  " }); expect(result.status).toBe(201); const list = await request(app).get("/api/tickets/" + ticketId + "/comments").set("Cookie", cookie); expect(list.body.data.at(-1).id).toBe(result.body.data.id); });
    it("COMMENT-07/08: cross-owner and edit/delete attempts expose nothing", async () => { for (const method of ["get", "post"] as const)
        expect((await request(app)[method]("/api/tickets/" + foreignId + "/comments").set("Cookie", cookie).send({ content: "hello" })).status).toBe(404); for (const method of ["patch", "delete"] as const)
        expect((await request(app)[method]("/api/tickets/" + ticketId + "/comments/" + randomUUID()).set("Cookie", cookie).send({ content: "changed" })).status).toBe(404); });
    it("RESOLVE-01/02/03: timestamp only; duplicate concurrent requests conflict", async () => { expect((await request(app).post("/api/tickets/" + foreignId + "/problem-appears-resolved").set("Cookie", cookie)).status).toBe(404); const results = await Promise.all([1, 2].map(() => request(app).post("/api/tickets/" + ticketId + "/problem-appears-resolved").set("Cookie", cookie).send({ status: "CLOSED", problemAppearsResolvedAt: "2000-01-01" }))); expect(results.map(r => r.status).sort()).toEqual([200, 409]); const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } }); expect(saved.currentStatus).toBe("New"); expect(saved.problemAppearsResolvedAt).not.toBeNull(); expect((await request(app).get("/api/tickets/" + ticketId).set("Cookie", cookie)).body.data.problemAppearsResolvedAt).toBe(saved.problemAppearsResolvedAt!.toISOString()); });
    it("AUTH-09: ticket-scoped attachment actions cannot cross ownership", async () => {
        for (const base of ["/api/tickets", "/api/v1/tickets"]) {
            const root = base + "/" + foreignId + "/attachments";
            for (const [method, path] of [["get", root], ["post", root], ["get", root + "/" + randomUUID() + "/download"], ["delete", root + "/" + randomUUID()]] as const) {
                const response = await request(app)[method](path).set("Cookie", cookie).set("X-Development-Requester-Id", bob).send({ reason: "Forged removal", requesterId: bob });
                expect(response.status).toBe(404);
                expect(response.body).not.toHaveProperty("data");
                expect((await request(app)[method](path).set("X-Development-Requester-Id", bob)).status).toBe(401);
            }
        }
    });
    it("requester detail serialization excludes private fields even if a query grows later", async () => {
        const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { requester: true, category: true, relatedSystem: true, attachments: true } });
        vi.spyOn(prisma.ticket, "findFirst").mockResolvedValueOnce({ ...ticket, internalNotes: [{ content: "private marker" }], passwordHash: "secret hash" } as never);
        const response = await request(app).get("/api/tickets/" + ticketId).set("Cookie", cookie);
        expect(response.status).toBe(200);
        expect(response.text).not.toMatch(/private marker|internalNotes|secret hash/);
    });
    it("safe unexpected failures do not disclose database details", async () => { vi.spyOn(prisma.publicComment, "findMany").mockRejectedValueOnce(new Error("database secret")); const result = await request(app).get("/api/tickets/" + ticketId + "/comments").set("Cookie", cookie); expect(result.status).toBe(500); expect(result.text).not.toContain("database secret"); });
});
