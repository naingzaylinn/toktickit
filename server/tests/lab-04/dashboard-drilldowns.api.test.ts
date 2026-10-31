import { beforeAll, afterAll, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { dashboardFixture, type DashboardFixture } from "./dashboardFixture.js";
let f: DashboardFixture;
beforeAll(async () => { f = await dashboardFixture(); for (const status of ["New", "Open", "InProgress", "WaitingForRequester", "Resolved", "Closed", "Reopened", "Cancelled"] as const)
  for (const priority of ["Low", "Medium", "High", "Urgent"] as const) for (const owner of [null, f.users[1].id, f.users[2].id]) await f.ticket(status, owner, priority);
}, 30000);
afterAll(async () => { await f?.close(); });
it.each([1, 2])("every dashboard card matches full Queue totals for role %s", async role => {
  const d = (await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[role])).body.data;
  const queries: Array<[string, number]> = [["", d.totalTickets], ["statusGroup=active", d.activeTickets], ["statusGroup=active&owner=unassigned", d.unassignedActiveTickets], ["statusGroup=active&owner=" + f.users[role].id, d.myActiveTickets]];
  for (const [key, count] of Object.entries(d.byStatus)) queries.push(["status=" + key, Number(count)]);
  for (const [key, count] of Object.entries(d.activeByItPriority)) queries.push(["statusGroup=active&itPriority=" + key, Number(count)]);
  for (const [query, count] of queries) { const r = await request(app).get("/api/staff/tickets?" + query).set("Cookie", f.cookies[role]); expect(r.status).toBe(200); expect(r.body.meta.totalItems).toBe(count); }
});
it.each(["CLOSED", "RESOLVED", "CANCELLED", "OPEN"])("single %s intersects active group", async status => {
  const r = await request(app).get(`/api/staff/tickets?statusGroup=active&status=${status}`).set("Cookie", f.cookies[1]);
  expect(r.status).toBe(200); expect(r.body.meta.totalItems).toBe(status === "OPEN" ? 12 : 0);
});
it("active group combines with search, owner and IT priority through AND", async () => {
  const r = await request(app).get(`/api/staff/tickets?statusGroup=active&search=Dashboard&owner=${f.users[1].id}&itPriority=URGENT&sort=ticketNumber&order=asc&pageSize=10`).set("Cookie", f.cookies[1]);
  expect(r.status).toBe(200); expect(r.body.meta.totalItems).toBe(5); expect(r.body.data.every((t: { owner: { id: string }; itPriority: string }) => t.owner.id === f.users[1].id && t.itPriority === "URGENT")).toBe(true);
});
it.each(["statusGroup=terminal", "statusGroup=active&statusGroup=active", "statusGroup[x]=active", "statusGroup="])("rejects invalid group %s", async query => {
  const r = await request(app).get("/api/staff/tickets?" + query).set("Cookie", f.cookies[1]); expect(r.status).toBe(400); expect(r.body.error.code).toBe("INVALID_QUERY_PARAMS");
});
