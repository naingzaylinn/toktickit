import { beforeAll, afterAll, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import * as dashboardService from "../../src/services/staffDashboard.js";
import { dashboardFixture, type DashboardFixture } from "./dashboardFixture.js";
let f: DashboardFixture;
beforeAll(async () => { f = await dashboardFixture(); await f.ticket(); }, 30000);
afterAll(async () => { await f?.close(); });
it("authorized no-query request executes calculations and returns the dashboard", async () => {
  const spy = vi.spyOn(dashboardService, "staffDashboard");
  try {
    const r = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[1]);
    expect(r.status).toBe(200); expect(r.body.data.totalTickets).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1); expect(spy).toHaveBeenCalledWith(f.users[1].id);
  } finally { spy.mockRestore(); }
});
it.each(["identity=forged", "owner=x", "page=1", "q=a&q=b", "user[id]=x",
  "__proto__=x", "%5F%5Fproto%5F%5F=x", "__proto__[owner]=x", "__proto__=a&__proto__=b",
  "owner[x]=y", "owner=x&owner=y", "%6Fwner=x",
])("rejects unsupported dashboard query %s before calculations", async q => {
  const spy = vi.spyOn(dashboardService, "staffDashboard");
  try {
    const r = await request(app).get("/api/staff/dashboard?" + q).set("Cookie", f.cookies[1]);
    expect(r.status).toBe(400); expect(r.body.error.code).toBe("INVALID_QUERY_PARAMS"); expect(r.body.data).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});
it.each([undefined, "toktickit_session=invalid"])("denies missing/malformed sessions %s", async cookie => {
  const r = await request(app).get("/api/staff/dashboard").set("Cookie", cookie ?? ""); expect(r.status).toBe(401); expect(r.body.data).toBeUndefined();
});
it("denies requester before query validation and inactive users", async () => {
  expect((await request(app).get("/api/staff/dashboard?owner=forged").set("Cookie", f.cookies[0])).status).toBe(403);
  expect((await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[3])).status).toBe(401);
});
it("honors password restriction, live role changes and expired sessions", async () => {
  await f.prisma.user.update({ where: { id: f.users[1].id }, data: { mustChangePassword: true } });
  let r = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[1]); expect(r.status).toBe(403); expect(r.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  await f.prisma.user.update({ where: { id: f.users[1].id }, data: { mustChangePassword: false, role: "REQUESTER" } });
  r = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[1]); expect(r.status).toBe(403);
  await f.prisma.user.update({ where: { id: f.users[1].id }, data: { role: "IT_STAFF" } });
  await f.prisma.session.updateMany({ where: { userId: f.users[1].id }, data: { expiresAt: new Date(0) } });
  r = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[1]); expect(r.status).toBe(401);
});
it("safe failures expose no diagnostics or fabricated metrics", async () => {
  const spy = vi.spyOn(f.prisma, "$transaction").mockRejectedValueOnce(new Error("secret SQL password"));
  try { const r = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[2]); expect(r.status).toBe(500); expect(r.body).toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to complete the request." } }); }
  finally { spy.mockRestore(); }
});
