import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import request from "supertest";
import app from "../../src/app.js";
import { dashboardFixture, type DashboardFixture } from "./dashboardFixture.js";
let f: DashboardFixture;
beforeAll(async () => { f = await dashboardFixture(); }, 30000);
afterAll(async () => { await f?.close(); });
it("empty real database returns every zero bucket and empty lists", async () => {
  const r = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[1]); expect(r.status).toBe(200);
  expect(r.body.data).toEqual({ totalTickets: 0, activeTickets: 0, unassignedActiveTickets: 0, myActiveTickets: 0,
    byStatus: { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 },
    activeByItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 }, recentTickets: [], myActions: { totalItems: 0, items: [] } });
});
it("keeps counts and rows in one real repeatable-read snapshot during an overlapping commit", async () => {
  const t = await f.ticket("Open", null, "Urgent");
  const original = f.prisma.$transaction.bind(f.prisma);
  let arrive!: () => void, release!: () => void;
  const reached = new Promise<void>(r => { arrive = r; }); const gate = new Promise<void>(r => { release = r; });
  let paused = false;
  const spy = vi.spyOn(f.prisma, "$transaction").mockImplementation(((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) => original(async tx => callback(new Proxy(tx, {
    get(target, key) { if (key !== "ticket") return Reflect.get(target, key); return new Proxy(target.ticket, {
      get(delegate, method) { if (method !== "groupBy") return Reflect.get(delegate, method);
        return async (args: Parameters<typeof delegate.groupBy>[0]) => { const result = await delegate.groupBy(args as never); if (!paused) { paused = true; arrive(); await gate; } return result; };
      },
    }); },
  })), { ...options, timeout: 8000 })) as typeof f.prisma.$transaction);
  let reading: Promise<request.Response> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    reading = Promise.resolve(request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[1]));
    await Promise.race([reached, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Snapshot barrier not reached")), 3000); })]);
    // A separate connection commits while the dashboard's transaction remains open.
    await f.prisma.ticket.update({ where: { id: t.id }, data: { currentStatus: "Closed", ownerId: f.users[1].id, itPriority: "Low" } });
    await f.action(t.id);
    release(); const d = (await reading).body.data;
    expect(d.activeTickets).toBe(1); expect(d.unassignedActiveTickets).toBe(1); expect(d.activeByItPriority.URGENT).toBe(1);
    expect(d.recentTickets[0].status).toBe("OPEN"); expect(d.recentTickets[0].owner).toBeNull(); expect(d.myActions.totalItems).toBe(0);
    expect(spy.mock.calls[0][1]).toMatchObject({ isolationLevel: "RepeatableRead" });
  } finally { release(); if (timer) clearTimeout(timer); await reading; spy.mockRestore(); }
  const fresh = (await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[1])).body.data;
  expect(fresh.activeTickets).toBe(0); expect(fresh.recentTickets[0].status).toBe("CLOSED"); expect(fresh.myActions.totalItems).toBe(1);
});
