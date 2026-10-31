import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import request from "supertest";
import app from "../../src/app.js";
import { requesterDashboardFixture, type RequesterFixture } from "./requesterDashboardFixture.js";
let f: RequesterFixture;
beforeAll(async () => { f = await requesterDashboardFixture(); }, 30000);
afterAll(async () => { await f?.close(); });
it("empty Requester sees all zero buckets even with foreign Tickets", async () => {
  await f.ownedTicket(f.other.id, "Resolved");
  const r = await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies[0]); expect(r.status).toBe(200);
  expect(r.body.data).toEqual({ totalTickets: 0, activeTickets: 0, waitingForRequesterTickets: 0, resolvedTickets: 0,
    byStatus: { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 }, recentTickets: [], resolvedTicketsRecent: [] });
});
it("keeps counts and rows in one real repeatable-read snapshot during an overlapping commit", async () => {
  const t = await f.ownedTicket(undefined, "Resolved");
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
    reading = Promise.resolve(request(app).get("/api/requester/dashboard").set("Cookie", f.cookies[0]));
    await Promise.race([reached, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Snapshot barrier not reached")), 3000); })]);
    // A separate connection commits while the dashboard's transaction remains open.
    await f.prisma.ticket.update({ where: { id: t.id }, data: { currentStatus: "Closed", ownerId: f.users[1].id, itPriority: "Low" } });
    await f.action(t.id);
    release(); const d = (await reading).body.data;
    expect(d.totalTickets).toBe(1); expect(d.resolvedTickets).toBe(1);
    expect(d.recentTickets[0].status).toBe("RESOLVED"); expect(d.resolvedTicketsRecent[0].id).toBe(t.id);
    expect(spy.mock.calls[0][1]).toMatchObject({ isolationLevel: "RepeatableRead" });
  } finally { release(); if (timer) clearTimeout(timer); await reading; spy.mockRestore(); }
  const fresh = (await request(app).get("/api/requester/dashboard").set("Cookie", f.cookies[0])).body.data;
  expect(fresh.activeTickets).toBe(0); expect(fresh.recentTickets[0].status).toBe("CLOSED"); expect(fresh.resolvedTickets).toBe(0); expect(fresh.resolvedTicketsRecent).toEqual([]);
});
