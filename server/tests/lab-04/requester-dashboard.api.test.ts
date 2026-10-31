import { beforeAll, afterAll, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { requesterDashboardFixture, requesterStatuses, requesterKeys, type RequesterFixture } from "./requesterDashboardFixture.js";
let f: RequesterFixture;
const ownIds: string[] = [];
beforeAll(async () => {
  f = await requesterDashboardFixture();
  for (const status of requesterStatuses) ownIds.push((await f.ownedTicket(undefined, status, new Date(status === "Closed" ? "2020-01-04" : "2020-01-01"), status === "Open" ? f.users[3].id : null)).id);
  for (let i = 0; i < 7; i++) ownIds.push((await f.ownedTicket(undefined, "Resolved", new Date(["2020-01-03", "2020-01-02", "2020-01-03", "2020-01-01", "2020-01-02", "2020-01-03", "2020-01-01"][i]))).id);
  for (let i = 0; i < 12; i++) await f.ownedTicket(f.other.id, i % 2 ? "Resolved" : "WaitingForRequester", new Date("2030-01-01"));
}, 30000);
afterAll(async () => { await f?.close(); });
it.each([false, true])("independent database metrics and lists for other=%s", async other => {
  const id = other ? f.other.id : f.users[0].id;
  const r = await request(app).get("/api/requester/dashboard").set("Cookie", other ? f.otherCookie : f.cookies[0]);
  expect(r.status).toBe(200); expect(r.headers["cache-control"]).toBe("no-store");
  const d = r.body.data;
  expect(Object.keys(d).sort()).toEqual(["totalTickets", "activeTickets", "waitingForRequesterTickets", "resolvedTickets", "byStatus", "recentTickets", "resolvedTicketsRecent"].sort());
  for (const count of [d.totalTickets, d.activeTickets, d.waitingForRequesterTickets, d.resolvedTickets, ...Object.values(d.byStatus)]) { expect(Number.isInteger(count)).toBe(true); expect(Number(count)).toBeGreaterThanOrEqual(0); }
  expect(d.totalTickets).toBe(await f.prisma.ticket.count({ where: { requesterId: id } }));
  expect(d.activeTickets).toBe(await f.prisma.ticket.count({ where: { requesterId: id, currentStatus: { in: ["New", "Open", "InProgress", "WaitingForRequester", "Reopened"] } } }));
  for (let i = 0; i < requesterStatuses.length; i++) expect(d.byStatus[requesterKeys[i]]).toBe(await f.prisma.ticket.count({ where: { requesterId: id, currentStatus: requesterStatuses[i] } }));
  expect(d.waitingForRequesterTickets).toBe(d.byStatus.WAITING_FOR_REQUESTER); expect(d.resolvedTickets).toBe(d.byStatus.RESOLVED);
  expect(Object.values(d.byStatus).reduce((a: number, b) => a + Number(b), 0)).toBe(d.totalTickets);
  expect(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].reduce((a, key) => a + d.byStatus[key], 0)).toBe(d.activeTickets);
  for (const [key, resolved] of [["recentTickets", false], ["resolvedTicketsRecent", true]] as const) {
    const rows = await f.prisma.ticket.findMany({ where: { requesterId: id, ...(resolved ? { currentStatus: "Resolved" as const } : {}) }, orderBy: [{ updatedAt: "desc" }, { ticketNumber: "asc" }], take: 5 });
    expect(d[key].map((t: { id: string }) => t.id)).toEqual(rows.map(t => t.id)); expect(d[key]).toHaveLength(5);
    for (const row of d[key]) expect(Object.keys(row).sort()).toEqual(["id", "ticketNumber", "summary", "status", "updatedAt"].sort());
  }
  expect(new Date(r.body.meta.generatedAt).toISOString()).toBe(r.body.meta.generatedAt);
  expect(JSON.stringify(d)).not.toMatch(/passwordHash|Sensitive description|ownerId|requesterId|email|internalNotes|actionResult/);
});
it("legacy zero-Action resolved work remains counted; Closed is separate", async () => {
  const d = (await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies[0])).body.data;
  expect(d.totalTickets).toBe(15); expect(d.activeTickets).toBe(5); expect(d.resolvedTickets).toBe(8); expect(d.byStatus.CLOSED).toBe(1);
  expect(await f.prisma.actionTaken.count()).toBe(0);
  expect(d.recentTickets.map((t: { ticketNumber: string }) => t.ticketNumber)).toEqual(["DASH-00006", "DASH-00009", "DASH-00011", "DASH-00014", "DASH-00010"]);
});
it("Actions with follow-up do not create a waiting predicate", async () => {
  const t = await f.ownedTicket(undefined, "Open"); await f.action(t.id, f.users[1].id, f.users[2].id);
  const d = (await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies[0])).body.data;
  expect(d.waitingForRequesterTickets).toBe(1);
});

it("mixed timestamps, ties, resolved limit and newer foreign rows produce exact owned ID sequences", async () => {
 const d = (await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies[0])).body.data;
 // Literal creation indices independently express DESC dates, then ASC numbers.
 expect(d.recentTickets.map((row: { id: string }) => row.id)).toEqual([5, 8, 10, 13, 9].map(i => ownIds[i]));
 expect(d.resolvedTicketsRecent.map((row: { id: string }) => row.id)).toEqual([8, 10, 13, 9, 12].map(i => ownIds[i]));
});
