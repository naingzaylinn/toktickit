import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import request from "supertest";
import app from "../../src/app.js";
import { dashboardFixture, type DashboardFixture } from "./dashboardFixture.js";
let f: DashboardFixture;
beforeAll(async () => { f = await dashboardFixture(); for (let i = 0; i < 150; i++) { const t = await f.ticket("Open", i % 2 ? f.users[1].id : null, "Urgent"); await f.action(t.id); } }, 30000);
afterAll(async () => { await f?.close(); });
it("large fixture uses fixed aggregate calls and bounded relation projections", async () => {
  const calls: Array<{ model: string; method: string; args: any }> = [];
  const original = f.prisma.$transaction.bind(f.prisma);
  const spy = vi.spyOn(f.prisma, "$transaction").mockImplementation(((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) => original(async tx => callback(new Proxy(tx, {
    get(target, key) { if (key !== "ticket" && key !== "actionTaken") return Reflect.get(target, key);
      const delegate = target[key]; return new Proxy(delegate, { get(model, method) { const value = Reflect.get(model, method); if (typeof value !== "function") return value;
        return (args: unknown) => { calls.push({ model: String(key), method: String(method), args }); return value.call(model, args); }; } });
    },
  })), options)) as typeof f.prisma.$transaction);
  const start = performance.now();
  try {
    const r = await request(app).get("/api/staff/dashboard").set("Cookie", f.cookies[1]); expect(r.status).toBe(200);
    expect(r.body.data.totalTickets).toBe(150); expect(r.body.data.myActions.totalItems).toBe(150);
    expect(r.body.data.recentTickets).toHaveLength(5); expect(r.body.data.myActions.items).toHaveLength(5);
    expect(calls).toHaveLength(7); const lists = calls.filter(c => c.method === "findMany"); expect(lists).toHaveLength(2);
    for (const call of lists) { expect(call.args.take).toBe(5); expect(call.args.select).toBeDefined(); }
    const plan = await f.prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>`EXPLAIN SELECT "id" FROM "Ticket" ORDER BY "updatedAt" DESC, "ticketNumber" ASC LIMIT 5`;
    expect(plan.some(row => row["QUERY PLAN"].includes("Limit"))).toBe(true);
    console.info(JSON.stringify({ fixtureTickets: 150, fixtureActions: 150, logicalQueries: calls.length, elapsedMs: Math.round(performance.now() - start), responseBytes: JSON.stringify(r.body).length, recentPlan: plan }));
  } finally { spy.mockRestore(); }
});
