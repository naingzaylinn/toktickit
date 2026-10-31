import { beforeAll, afterAll, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { requesterDashboardFixture, requesterStatuses, requesterKeys, type RequesterFixture } from "./requesterDashboardFixture.js";
let f: RequesterFixture;
beforeAll(async () => { f = await requesterDashboardFixture(); for (const status of requesterStatuses) { await f.ownedTicket(undefined, status); await f.ownedTicket(f.other.id, status); } }, 30000);
afterAll(async () => { await f?.close(); });
it.each(["/api/tickets", "/api/v1/tickets"])("every card matches owned list %s", async base => {
  const d = (await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies[0])).body.data;
  const queries: Array<[string, number]> = [["", d.totalTickets], ["statusGroup=active", d.activeTickets], ["currentStatus=WaitingForRequester", d.waitingForRequesterTickets], ["currentStatus=Resolved", d.resolvedTickets]];
  requesterStatuses.forEach((status, i) => queries.push(["currentStatus=" + status, d.byStatus[requesterKeys[i]]]));
  for (const [query, count] of queries) { const r = await request(app).get(base + "?" + query).set("Cookie", f.cookies[0]); expect(r.status).toBe(200); expect(r.body.pagination.totalItems).toBe(count); }
  for (const [key, query] of [["recentTickets", "sortBy=recentlyUpdated"], ["resolvedTicketsRecent", "currentStatus=Resolved&sortBy=recentlyUpdated"]]) {
    const r = await request(app).get(base + "?" + query).set("Cookie", f.cookies[0]); expect(r.body.data.slice(0, 5).map((t: { id: string }) => t.id)).toEqual(d[key].map((t: { id: string }) => t.id));
  }
});
it.each(["Closed", "Cancelled", "Resolved", "Open"])("intersects active with %s", async status => {
  const r = await request(app).get("/api/tickets?statusGroup=active&currentStatus=" + status).set("Cookie", f.cookies[0]); expect(r.status).toBe(200); expect(r.body.pagination.totalItems).toBe(status === "Open" ? 1 : 0);
});
it.each(["currentStatus=", "currentStatus=OPEN", "currentStatus=Open&currentStatus=Open", "currentStatus[x]=Open", "statusGroup=", "statusGroup=terminal", "statusGroup=active&statusGroup=active", "statusGroup[x]=active"])("rejects invalid status filter %s", async query => {
  const r = await request(app).get("/api/tickets?" + query).set("Cookie", f.cookies[0]); expect(r.status).toBe(400); expect(r.body.error.code).toBe("INVALID_QUERY_PARAMS");
});
