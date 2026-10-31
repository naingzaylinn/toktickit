import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { dashboardFixture, type DashboardFixture } from "./dashboardFixture.js";

let f: DashboardFixture;
const statuses = ["New", "Open", "InProgress", "WaitingForRequester", "Resolved", "Closed", "Reopened", "Cancelled"] as const;
const keys = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const active = ["New", "Open", "InProgress", "WaitingForRequester", "Reopened"] as const;
const get = (cookie?: string) => request(app).get("/api/staff/dashboard").set("Cookie", cookie ?? f.cookies[1]);
beforeAll(async () => {
  f = await dashboardFixture();
  for (let i = 0; i < statuses.length; i++) {
    const ticket = await f.ticket(statuses[i], [null, f.users[1].id, f.users[2].id, f.users[3].id][i % 4], ["Low", "Medium", "High", "Urgent"][i % 4] as "Low");
    await f.action(ticket.id, f.users[1].id, i === 0 ? f.users[3].id : f.users[2].id, ["PENDING", "COMPLETED", "CANCELLED"][i % 3] as "PENDING");
  }
  const extra = await f.ticket("Open", f.users[2].id, "Urgent");
  await f.action(extra.id, f.users[2].id, f.users[1].id);
}, 30000);
afterAll(async () => { await f?.close(); });
describe("Staff dashboard database calculations", () => {
  it.each([1, 2])("role %s matches independently expressed database counts and personal performer", async role => {
    const response = await get(f.cookies[role]); expect(response.status).toBe(200); expect(response.headers["cache-control"]).toBe("no-store");
    const d = response.body.data;
    expect(d.totalTickets).toBe(await f.prisma.ticket.count());
    expect(d.activeTickets).toBe(await f.prisma.ticket.count({ where: { currentStatus: { in: [...active] } } }));
    expect(d.unassignedActiveTickets).toBe(await f.prisma.ticket.count({ where: { currentStatus: { in: [...active] }, ownerId: null } }));
    expect(d.myActiveTickets).toBe(await f.prisma.ticket.count({ where: { currentStatus: { in: [...active] }, ownerId: f.users[role].id } }));
    for (let i = 0; i < statuses.length; i++) expect(d.byStatus[keys[i]]).toBe(await f.prisma.ticket.count({ where: { currentStatus: statuses[i] } }));
    for (const priority of ["Low", "Medium", "High", "Urgent"] as const) expect(d.activeByItPriority[priority.toUpperCase()]).toBe(await f.prisma.ticket.count({ where: { currentStatus: { in: [...active] }, itPriority: priority } }));
    expect(Object.values(d.byStatus).reduce((a: number, b) => a + Number(b), 0)).toBe(d.totalTickets);
    expect(Object.values(d.activeByItPriority).reduce((a: number, b) => a + Number(b), 0)).toBe(d.activeTickets);
    expect(d.myActions.totalItems).toBe(await f.prisma.actionTaken.count({ where: { performedById: f.users[role].id } }));
    expect(new Date(response.body.meta.generatedAt).toISOString()).toBe(response.body.meta.generatedAt);
  });
  it("caps and deterministically orders recent Tickets and original Actions including terminal parents", async () => {
    const d = (await get()).body.data;
    const tickets = await f.prisma.ticket.findMany({ take: 5, orderBy: [{ updatedAt: "desc" }, { ticketNumber: "asc" }] });
    expect(d.recentTickets.map((t: { id: string }) => t.id)).toEqual(tickets.map(t => t.id));
    expect(d.recentTickets.map((t: { ticketNumber: string }) => t.ticketNumber)).toEqual(["DASH-00001", "DASH-00002", "DASH-00003", "DASH-00004", "DASH-00005"]);
    const actions = await f.prisma.actionTaken.findMany({ where: { performedById: f.users[1].id }, take: 5, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    expect(d.myActions.items.map((a: { id: string }) => a.id)).toEqual(actions.map(a => a.id));
    expect(d.myActions.totalItems).toBe(8);
    expect(d.myActions.items.map((a: { actionDateTime: string }) => a.actionDateTime)).toEqual(actions.map(a => a.createdAt.toISOString()));
  });
  it("returns only the exact safe projections and retains an inactive assignee", async () => {
    const newest = await f.ticket("Closed", f.users[3].id, "Urgent", new Date("2030-01-01"));
    await f.action(newest.id, f.users[1].id, f.users[3].id, "CANCELLED", new Date("2030-01-01"));
    const d = (await get()).body.data;
    expect(Object.keys(d.recentTickets[0]).sort()).toEqual(["id", "ticketNumber", "summary", "status", "itPriority", "owner", "updatedAt"].sort());
    expect(Object.keys(d.recentTickets[0].owner).sort()).toEqual(["id", "name"]);
    expect(Object.keys(d.myActions.items[0]).sort()).toEqual(["id", "ticketId", "ticketNumber", "actionDateTime", "actionDescription", "followUpRequired", "status", "assignee"].sort());
    expect(d.myActions.items[0].assignee).toEqual({ id: f.users[3].id, name: f.users[3].name, role: "IT_STAFF", isActive: false });
    expect(JSON.stringify(d)).not.toMatch(/passwordHash|Sensitive description|followUpNote|clientRequestId|revisions|email|internalNotes/);
  });
  it("reassignment and later editor/completer do not replace original performer or creation date", async () => {
    const t = await f.ticket(); const a = await f.action(t.id, f.users[1].id, f.users[2].id, "PENDING", new Date("2031-01-01"));
    const edited = await request(app).patch(`/api/staff/tickets/${t.id}/actions/${a.id}`).set("Cookie", f.cookies[2]).send({ expectedVersion: 1, assigneeId: f.users[2].id, status: "COMPLETED", followUpRequired: false, actionDescription: "Corrected work" });
    expect(edited.status).toBe(200);
    const item = (await get()).body.data.myActions.items[0]; expect(item.id).toBe(a.id); expect(item.status).toBe("COMPLETED"); expect(item.actionDateTime).toBe(a.createdAt.toISOString());
    expect((await get(f.cookies[2])).body.data.myActions.items.some((x: { id: string }) => x.id === a.id)).toBe(false);
    const parent = await f.prisma.ticket.findUniqueOrThrow({ where: { id: t.id } }); expect(parent.updatedAt.getTime()).toBeGreaterThan(new Date("2020-01-01").getTime());
  });
  it("inactive owners remain assigned and requested priority never changes the authoritative urgent bucket", async () => {
    const t = await f.ticket("Open", f.users[3].id, "Urgent");
    const before = (await get()).body.data;
    await f.prisma.ticket.update({ where: { id: t.id }, data: { requestedPriority: "High" } });
    const after = (await get()).body.data;
    expect(after.unassignedActiveTickets).toBe(before.unassignedActiveTickets);
    expect(after.activeByItPriority).toEqual(before.activeByItPriority);
    const count = await f.prisma.ticket.count({ where: { ownerId: null, currentStatus: { in: [...active] } } }); expect(after.unassignedActiveTickets).toBe(count);
  });
  it("Action creation advances parent activity, but replay, no-op and communication do not fabricate activity", async () => {
    const t = await f.ticket(); const path = `/api/staff/tickets/${t.id}`;
    const input = { clientRequestId: crypto.randomUUID(), actionDescription: "Activity work", actionResult: "Pending checks", followUpRequired: false };
    const created = await request(app).post(path + "/actions").set("Cookie", f.cookies[1]).send(input); expect(created.status).toBe(201);
    const parent = await f.prisma.ticket.findUniqueOrThrow({ where: { id: t.id } }); expect(parent.updatedAt.getTime()).toBeGreaterThan(t.updatedAt.getTime());
    expect((await request(app).post(path + "/actions").set("Cookie", f.cookies[1]).send(input)).status).toBe(200);
    expect((await request(app).patch(path + "/actions/" + created.body.data.id).set("Cookie", f.cookies[1]).send({ expectedVersion: 1, actionDescription: input.actionDescription })).status).toBe(200);
    expect((await request(app).post(path + "/notes").set("Cookie", f.cookies[1]).send({ content: "Private operational note" })).status).toBe(201);
    expect((await request(app).post(`/api/tickets/${t.id}/comments`).set("Cookie", f.cookies[1]).send({ content: "Public progress comment" })).status).toBe(201);
    const unchanged = await f.prisma.ticket.findUniqueOrThrow({ where: { id: t.id } }); expect(unchanged.updatedAt).toEqual(parent.updatedAt); expect(unchanged.workflowVersion).toBe(parent.workflowVersion);
  });
});
