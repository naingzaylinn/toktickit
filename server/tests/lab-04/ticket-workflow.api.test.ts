import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { Prisma, type TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterCookie } from "../lab-03/sessionFixture.js";

const prisma = getPrisma();
if (!/^issue2_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL ?? "postgresql://invalid").searchParams.get("schema") ?? "")) {
  throw new Error("Use npm run test:isolated for Ticket workflow tests.");
}
const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const [requesterId, staffId, adminId, otherId] = ids;
const tickets: string[] = [];
let staff: string, admin: string, requester: string, other: string;
let categoryId: number, relatedSystemId: string;
const db: Record<string, TicketStatus> = { NEW: "New", OPEN: "Open", IN_PROGRESS: "InProgress", WAITING_FOR_REQUESTER: "WaitingForRequester", RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled" };
// Independent expected contract, not imported from the implementation.
const matrix: Record<string, string[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"], OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"], CLOSED: ["REOPENED"], REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], CANCELLED: ["REOPENED"],
};
const base = (id: string) => `/api/staff/tickets/${id}`;
const read = (id: string) => request(app).get(base(id)).set("Cookie", staff);
const status = (id: string, next: string, version: unknown, cookie = staff) => request(app).patch(base(id) + "/status").set("Cookie", cookie).send({ status: next, expectedWorkflowVersion: version });
const state = async (id: string) => ({ ticket: await prisma.ticket.findUniqueOrThrow({ where: { id } }),
  actions: await prisma.actionTaken.findMany({ where: { ticketId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
  revisions: await prisma.actionTakenRevision.findMany({ where: { action: { ticketId: id } }, orderBy: { id: "asc" } }),
});
async function ticket(currentStatus: TicketStatus = "Open") {
  const row = await prisma.ticket.create({ data: { ticketNumber: `WF-${randomUUID()}`, clientRequestId: randomUUID(), requesterId, categoryId, relatedSystemId, currentStatus, summary: "Workflow fixture", description: "Protected Ticket description" } });
  tickets.push(row.id); return row.id;
}
async function action(id: string, target: "PENDING" | "COMPLETED" | "CANCELLED" = "COMPLETED", followUpRequired = false) {
  const created = await request(app).post(base(id) + "/actions").set("Cookie", staff).send({ clientRequestId: randomUUID(), actionDescription: "Private to error responses", actionResult: "Verified outcome", followUpRequired, ...(followUpRequired ? { followUpNote: "Verify with requester" } : {}) });
  expect(created.status).toBe(201);
  if (target === "PENDING") return created.body.data;
  const completed = await request(app).patch(base(id) + "/actions/" + created.body.data.id).set("Cookie", admin).send({ expectedVersion: 1, status: target, actionResult: "Verified outcome or cancellation reason" });
  expect(completed.status).toBe(200); return completed.body.data;
}
beforeAll(async () => {
  await prisma.user.createMany({ data: ids.map((id, index) => ({ id, name: `Workflow user ${index}`, email: `${id}@workflow.test`, role: index === 1 ? "IT_STAFF" : index === 2 ? "ADMINISTRATOR" : "REQUESTER", passwordHash: "fixture", mustChangePassword: false })) });
  [requester, staff, admin, other] = await Promise.all(ids.map(requesterCookie));
  categoryId = (await prisma.category.findFirstOrThrow()).id; relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow()).id;
});
afterAll(async () => {
  await prisma.actionTakenRevision.deleteMany({ where: { action: { ticketId: { in: tickets } } } });
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: tickets } } });
  await prisma.ticket.deleteMany({ where: { id: { in: tickets } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("Issue #60 Ticket workflow", () => {
  for (const role of ["Staff", "Admin"]) {
    it.each(Object.keys(matrix).flatMap(from => Object.keys(matrix).map(to => [from, to])))(`${role}: %s -> %s preserves the exact matrix and atomic version`, async (from, to) => {
      const id = await ticket(); await action(id);
      await prisma.ticket.update({ where: { id }, data: { currentStatus: db[from] } });
      const before = await state(id);
      const allowed = matrix[from].includes(to);
      const response = await status(id, to, before.ticket.workflowVersion, role === "Staff" ? staff : admin);
      expect(response.status).toBe(allowed ? 200 : 409);
      const after = await state(id);
      if (allowed) {
        expect(response.body.data).toEqual({ status: to, workflowVersion: before.ticket.workflowVersion + 1 });
        expect(after.ticket).toEqual({ ...before.ticket, currentStatus: db[to], workflowVersion: before.ticket.workflowVersion + 1, updatedAt: after.ticket.updatedAt });
        expect(after.ticket.updatedAt.getTime()).toBeGreaterThanOrEqual(before.ticket.updatedAt.getTime());
        expect(after.actions).toEqual(before.actions); expect(after.revisions).toEqual(before.revisions);
      } else { expect(response.body.error.code).toBe("CONFLICT"); expect(after).toEqual(before); }
    });
  }
  it.each([undefined, null, "0", -1, 0.5, true, {}, [], 2147483648, Number.MAX_SAFE_INTEGER])("rejects invalid/missing workflow token %j without writes", async version => {
    const id = await ticket(); const before = await state(id);
    expect((await status(id, "IN_PROGRESS", version)).status).toBe(400); expect(await state(id)).toEqual(before);
  });
  it("rejects unknown status, extra fields and array bodies; validates before existence", async () => {
    const id = await ticket(); const before = await state(id);
    for (const body of [{ status: "BOGUS", expectedWorkflowVersion: 0 }, { status: "NEW", expectedWorkflowVersion: 0, actorId: adminId }, []]) {
      const result = await request(app).patch(base(id) + "/status").set("Cookie", staff).send(body);
      expect(result.status).toBe(400); expect(result.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await status(randomUUID(), "IN_PROGRESS", undefined)).status).toBe(400);
    expect((await status(randomUUID(), "IN_PROGRESS", 0)).status).toBe(404);
    expect(await state(id)).toEqual(before);
  });
  it("enforces request-time session, password and current role before disclosure", async () => {
    const id = await ticket(); const before = await state(id);
    expect((await request(app).patch(base(id) + "/status").send({ status: "RESOLVED", expectedWorkflowVersion: 0 })).status).toBe(401);
    for (const cookie of [requester, other]) {
      expect((await status(id, "RESOLVED", 0, cookie)).status).toBe(403);
      expect((await status(randomUUID(), "RESOLVED", undefined, cookie)).status).toBe(403);
      expect((await request(app).get(base(id)).set("Cookie", cookie)).status).toBe(403);
    }
    for (const change of [{ mustChangePassword: true }, { role: "REQUESTER" as const }, { isActive: false }]) {
      await prisma.user.update({ where: { id: staffId }, data: change });
      try { expect((await status(id, "IN_PROGRESS", 0)).status).toBe("isActive" in change ? 401 : 403); }
      finally { await prisma.user.update({ where: { id: staffId }, data: { role: "IT_STAFF", isActive: true, mustChangePassword: false } }); }
    }
    // Inactive middleware invalidates the session; restore a real fixture session.
    staff = await requesterCookie(staffId);
    expect(await state(id)).toEqual(before);
  });
  it("rejects stale versions before edge/gate checks and detects ABA", async () => {
    const id = await ticket();
    expect((await status(id, "IN_PROGRESS", 0)).status).toBe(200);
    expect((await status(id, "WAITING_FOR_REQUESTER", 1)).status).toBe(200);
    expect((await status(id, "IN_PROGRESS", 2)).status).toBe(200);
    const before = await state(id);
    for (const next of ["RESOLVED", "CLOSED", "IN_PROGRESS"]) expect((await status(id, next, 1)).body.error).toMatchObject({ code: "CONFLICT", message: expect.stringContaining("state changed") });
    expect(await state(id)).toEqual(before);
  });
  it.each([
    [[], ["NO_COMPLETED_ACTIONS"]],
    [["CANCELLED:true"], ["NO_COMPLETED_ACTIONS"]],
    [["PENDING:false"], ["NO_COMPLETED_ACTIONS", "PENDING_ACTIONS"]],
    [["COMPLETED:false", "PENDING:false"], ["PENDING_ACTIONS"]],
    [["COMPLETED:true", "PENDING:false"], ["PENDING_ACTIONS", "FOLLOW_UP_REQUIRED"]],
    [["COMPLETED:true"], ["FOLLOW_UP_REQUIRED"]],
    [["COMPLETED:false", "CANCELLED:true"], []],
  ] as [string[], string[]][])("uses the exact gate for %j with every applicable reason", async (children, reasons) => {
    const id = await ticket();
    for (const child of children) { const [s, flag] = child.split(":"); await action(id, s as "COMPLETED" | "PENDING" | "CANCELLED", flag === "true"); }
    const before = await state(id); const detail = (await read(id)).body.data;
    expect(detail.resolutionEligibility).toEqual({ eligible: !reasons.length, reasonCodes: reasons });
    const result = await status(id, "RESOLVED", before.ticket.workflowVersion);
    expect(result.status).toBe(reasons.length ? 409 : 200);
    if (reasons.length) {
      expect(result.body.error).toEqual({ code: "RESOLUTION_REQUIREMENTS_NOT_MET", message: expect.any(String), reasonCodes: reasons });
      expect(JSON.stringify(result.body)).not.toMatch(/Private|description|Verify with|password|SQL|stack/);
      expect(await state(id)).toEqual(before);
    }
  });
  it("counts every Action state, ignores pending/cancelled follow-up flags and clears completed follow-up only explicitly", async () => {
    const id = await ticket(); const completed = await action(id, "COMPLETED", true);
    await action(id, "PENDING", true); await action(id, "CANCELLED", true);
    const summary = (await read(id)).body.data;
    expect(summary.actionsTakenSummary).toEqual({ totalItems: 3, pendingItems: 1, completedItems: 1, cancelledItems: 1, followUpRequiredItems: 1 });
    expect(summary.resolutionEligibility.reasonCodes).toEqual(["PENDING_ACTIONS", "FOLLOW_UP_REQUIRED"]);
    const before = await state(id);
    expect((await request(app).patch(base(id) + "/actions/" + completed.id).set("Cookie", staff).send({ expectedVersion: 2, followUpRequired: false })).status).toBe(400);
    expect(await state(id)).toEqual(before);
    expect((await request(app).patch(base(id) + "/actions/" + completed.id).set("Cookie", staff).send({ expectedVersion: 2, followUpRequired: false, followUpNote: "Requester verified outcome" })).status).toBe(200);
    expect((await read(id)).body.data.resolutionEligibility.reasonCodes).toEqual(["PENDING_ACTIONS"]);
    expect((await state(id)).revisions.filter(r => r.actionId === completed.id)).toHaveLength(3);
  });
  it("closes legacy zero-Action resolved Tickets but gates children; reopen/re-resolve preserves all histories", async () => {
    const legacy = await ticket("Resolved");
    expect((await read(legacy)).body.data.resolutionEligibility.eligible).toBe(false);
    expect((await status(legacy, "CLOSED", 0)).status).toBe(200);
    expect((await status(legacy, "REOPENED", 1)).status).toBe(200);
    expect((await status(legacy, "RESOLVED", 2)).body.error.code).toBe("RESOLUTION_REQUIREMENTS_NOT_MET");
    const id = await ticket(); await action(id, "PENDING");
    await prisma.ticket.update({ where: { id }, data: { currentStatus: "Resolved" } });
    const before = await state(id);
    const rejectedClose = await status(id, "CLOSED", before.ticket.workflowVersion);
    expect(rejectedClose.status).toBe(409);
    expect(rejectedClose.body.error.code).toBe("RESOLUTION_REQUIREMENTS_NOT_MET");
    expect(rejectedClose.body.error.reasonCodes).toEqual(["NO_COMPLETED_ACTIONS", "PENDING_ACTIONS"]);
    expect(await state(id)).toEqual(before);
    const valid = await ticket(); await action(valid); const start = await state(valid);
    for (const [index, destination] of ["RESOLVED", "CLOSED", "REOPENED", "RESOLVED"].entries()) expect((await status(valid, destination, start.ticket.workflowVersion + index)).status).toBe(200);
    const end = await state(valid); expect(end.actions).toEqual(start.actions); expect(end.revisions).toEqual(start.revisions);
  });
  it("requester indication remains advisory before/after reopen and cannot bypass the gate", async () => {
    const id = await ticket(); const before = await state(id);
    const indication = await request(app).post(`/api/tickets/${id}/problem-appears-resolved`).set("Cookie", requester).send({ status: "RESOLVED" });
    expect(indication.status).toBe(200);
    const indicated = await state(id);
    expect(indicated.ticket).toMatchObject({ currentStatus: before.ticket.currentStatus, workflowVersion: 0, ownerId: before.ticket.ownerId });
    expect(indicated.actions).toEqual(before.actions); expect(indicated.revisions).toEqual(before.revisions);
    expect((await status(id, "RESOLVED", 0)).body.error.code).toBe("RESOLUTION_REQUIREMENTS_NOT_MET");
    expect((await status(id, "CANCELLED", 0)).status).toBe(200); expect((await status(id, "REOPENED", 1)).status).toBe(200);
    const reopened = await state(id); expect(reopened.ticket.problemAppearsResolvedAt).toEqual(indicated.ticket.problemAppearsResolvedAt);
    expect((await request(app).post(`/api/tickets/${id}/problem-appears-resolved`).set("Cookie", requester)).status).toBe(409);
    expect((await request(app).post(`/api/tickets/${id}/problem-appears-resolved`).set("Cookie", other)).status).toBe(404);
    expect(await state(id)).toEqual(reopened);
    const fresh = await ticket();
    const concurrent = await Promise.all([1, 2].map(() => request(app).post(`/api/tickets/${fresh}/problem-appears-resolved`).set("Cookie", requester)));
    expect(concurrent.map(r => r.status).sort()).toEqual([200, 409]); expect((await state(fresh)).ticket.workflowVersion).toBe(0);
  });
  it("only one simultaneous same-version status request succeeds", async () => {
    const id = await ticket();
    const results = await Promise.all([status(id, "IN_PROGRESS", 0), status(id, "WAITING_FOR_REQUESTER", 0, admin)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]); expect((await state(id)).ticket.workflowVersion).toBe(1);
  });
});

// Pause the first real parent lock, observe the second connection blocked in
// PostgreSQL, then release. Sleeps pace observation; they do not establish order.
async function ordered(first: () => PromiseLike<request.Response>, second: () => PromiseLike<request.Response>) {
  const original = prisma.$transaction.bind(prisma);
  let release!: () => void, arrived!: (pid: number) => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<number>(resolve => { arrived = resolve; });
  let locks = 0;
  const timer = setTimeout(release, 4000);
  const spy = vi.spyOn(prisma, "$transaction").mockImplementation(((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) => original(async tx => callback(new Proxy(tx, {
    get(target, key) {
      if (key !== "$queryRaw") return Reflect.get(target, key);
      return async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const result = await target.$queryRaw(strings, ...values);
        if (strings.join("").includes('FROM "Ticket"') && strings.join("").includes("FOR UPDATE") && ++locks === 1) {
          const [connection] = await target.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          arrived(connection.pid); await gate;
        }
        return result;
      };
    },
  })), { ...options, timeout: 8000 })) as typeof prisma.$transaction);
  let one: Promise<request.Response> | undefined, two: Promise<request.Response> | undefined;
  try {
    one = Promise.resolve(first());
    const pid = await Promise.race([ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("First Ticket lock not reached")), 3000))]);
    two = Promise.resolve(second());
    let blocked = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      const [row] = await prisma.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))) AS waiting`;
      if (row.waiting) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(blocked, "Second operation must wait on the first parent lock").toBe(true);
    release(); return await Promise.all([one, two]);
  } finally { release(); clearTimeout(timer); await Promise.allSettled([one, two]); spy.mockRestore(); }
}

describe("Ticket / Action serialization", () => {
  for (const firstIsStatus of [true, false]) {
    it.each(["resolve-create", "resolve-complete", "resolve-cancel", "close-correction", "close-invalid-correction", "cancel-reassign", "reopen-create", "status-status"])(`%s, status first=${firstIsStatus}`, async scenario => {
      const id = await ticket();
      const completed = await action(id);
      const pending = ["resolve-complete", "resolve-cancel", "cancel-reassign"].includes(scenario) ? await action(id, "PENDING") : null;
      if (scenario.startsWith("close")) await prisma.ticket.update({ where: { id }, data: { currentStatus: "Resolved" } });
      if (scenario === "reopen-create") await prisma.ticket.update({ where: { id }, data: { currentStatus: "Cancelled" } });
      const before = await state(id); const version = before.ticket.workflowVersion;
      const destination = scenario.startsWith("close") ? "CLOSED" : scenario === "cancel-reassign" ? "CANCELLED" : scenario === "reopen-create" ? "REOPENED" : scenario === "status-status" ? "IN_PROGRESS" : "RESOLVED";
      const formal = () => status(id, destination, version).timeout({ deadline: 10000 });
      const child = () => {
        if (scenario.endsWith("create")) return request(app).post(base(id) + "/actions").set("Cookie", admin).send({ clientRequestId: randomUUID(), actionDescription: "Concurrent work", actionResult: "Pending", followUpRequired: false }).timeout({ deadline: 10000 });
        if (scenario === "status-status") return status(id, "WAITING_FOR_REQUESTER", version, admin).timeout({ deadline: 10000 });
        const current = pending ?? completed;
        const change = scenario === "resolve-complete" ? { status: "COMPLETED" } : scenario === "resolve-cancel" ? { status: "CANCELLED", actionResult: "No longer needed" } : scenario === "cancel-reassign" ? { assigneeId: adminId } : scenario === "close-invalid-correction" ? { followUpRequired: true, followUpNote: "More verification needed" } : { actionResult: "Corrected verified result" };
        return request(app).patch(base(id) + "/actions/" + current.id).set("Cookie", admin).send({ expectedVersion: current.version, ...change }).timeout({ deadline: 10000 });
      };
      const responses = await ordered(firstIsStatus ? formal : child, firstIsStatus ? child : formal);
      const [formalResult, childResult] = firstIsStatus ? responses : [responses[1], responses[0]];
      const expected = firstIsStatus
        ? scenario === "reopen-create" ? [200, 201] : ["resolve-complete", "resolve-cancel"].includes(scenario) ? [409, 200] : scenario === "close-correction" ? [200, 200] : [200, 409]
        : ["reopen-create", "close-invalid-correction"].includes(scenario) ? [200, 409] : [409, scenario === "resolve-create" ? 201 : 200];
      expect([formalResult.status, childResult.status]).toEqual(expected);
      if (formalResult.status === 409) {
        if (firstIsStatus && ["resolve-complete", "resolve-cancel"].includes(scenario)) {
          expect(formalResult.body.error.code).toBe("RESOLUTION_REQUIREMENTS_NOT_MET");
          expect(formalResult.body.error.reasonCodes).toEqual(["PENDING_ACTIONS"]);
        } else {
          expect(formalResult.body.error.code).toBe("CONFLICT");
          expect(formalResult.body.error).not.toHaveProperty("reasonCodes");
        }
      }
      if (childResult.status === 409) {
        expect(childResult.body.error.code).toBe(scenario === "status-status" ? "CONFLICT" : "TICKET_WORKFLOW_CONFLICT");
        expect(childResult.body.error).not.toHaveProperty("reasonCodes");
      }

      const after = await state(id);
      const successes = responses.filter(r => [200, 201].includes(r.status)).length;
      expect(after.ticket.workflowVersion).toBe(version + successes);
      if (["Resolved", "Closed"].includes(after.ticket.currentStatus)) expect((await read(id)).body.data.resolutionEligibility).toEqual({ eligible: true, reasonCodes: [] });
      // Earlier immutable revisions never change, regardless of winning order.
      for (const revision of before.revisions) expect(after.revisions.find(r => r.id === revision.id)).toEqual(revision);
      if (scenario === "cancel-reassign" && firstIsStatus) expect(after.actions).toEqual(before.actions);
    });
  }
  it("reads version and summary in the same snapshot while an Action commits between queries", async () => {
    const id = await ticket(); const pending = await action(id, "PENDING");
    const original = prisma.$transaction.bind(prisma);
    let release!: () => void, arrived!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { arrived = resolve; });
    const timer = setTimeout(release, 4000);
    let paused = false;
    const spy = vi.spyOn(prisma, "$transaction").mockImplementation(((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: object) => original(async tx => callback(new Proxy(tx, {
      get(target, key) {
        if (key !== "ticket") return Reflect.get(target, key);
        return new Proxy(target.ticket, { get(delegate, method) {
          if (method !== "findUnique") return Reflect.get(delegate, method);
          return async (args: Parameters<typeof delegate.findUnique>[0]) => {
            const result = await delegate.findUnique(args);
            if (!paused && args.select && "requester" in args.select) { paused = true; arrived(); await gate; }
            return result;
          };
        } });
      },
    })), { ...options, timeout: 8000 })) as typeof prisma.$transaction);
    let reading: Promise<request.Response> | undefined;
    try {
      reading = Promise.resolve(read(id));
      await Promise.race([ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Detail snapshot not reached")), 3000))]);
      const mutation = await request(app).patch(base(id) + "/actions/" + pending.id).set("Cookie", admin).send({ expectedVersion: 1, status: "COMPLETED" });
      expect(mutation.status).toBe(200); release();
      const old = (await reading).body.data;
      expect(old.workflowVersion).toBe(1); expect(old.actionsTakenSummary.pendingItems).toBe(1); expect(old.actionsTakenSummary.completedItems).toBe(0);
      expect(old.resolutionEligibility.reasonCodes).toEqual(["NO_COMPLETED_ACTIONS", "PENDING_ACTIONS"]);
    } finally { release(); clearTimeout(timer); await reading; spy.mockRestore(); }
    const fresh = (await read(id)).body.data;
    expect(fresh.workflowVersion).toBe(2); expect(fresh.actionsTakenSummary.completedItems).toBe(1); expect(fresh.resolutionEligibility.eligible).toBe(true);
  });
  it("rolls back a failing status write without altering history and returns no diagnostics", async () => {
    const id = await ticket(); await action(id); const before = await state(id);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION issue60_fail_status() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${id}' THEN RAISE EXCEPTION 'private database diagnostic'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER issue60_fail_status BEFORE UPDATE ON "Ticket" FOR EACH ROW EXECUTE FUNCTION issue60_fail_status()');
    try {
      const result = await status(id, "RESOLVED", before.ticket.workflowVersion);
      expect(result.status).toBe(500); expect(result.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(JSON.stringify(result.body)).not.toMatch(/private|SQL|stack|prisma/i); expect(await state(id)).toEqual(before);
    } finally { await prisma.$executeRawUnsafe('DROP TRIGGER issue60_fail_status ON "Ticket"'); await prisma.$executeRawUnsafe('DROP FUNCTION issue60_fail_status()'); }
  });
  it.each(["P2034", "P2028"])("returns a safe conflict for %s without retries", async code => {
    const id = await ticket(); const before = await state(id);
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("private diagnostic", { code, clientVersion: "test" }));
    try {
      const response = await status(id, "IN_PROGRESS", 0);
      expect(response.status).toBe(409); expect(response.body.error.code).toBe("CONFLICT"); expect(JSON.stringify(response.body)).not.toContain("private"); expect(spy).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
    expect(await state(id)).toEqual(before);
  });
});
