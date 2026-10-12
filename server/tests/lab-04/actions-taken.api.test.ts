import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterCookie } from "../lab-03/sessionFixture.js";

const prisma = getPrisma();
// Refuse destructive fixture setup unless the repository runner supplied its schema.
if (!/^issue2_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL ?? "postgresql://invalid").searchParams.get("schema") ?? "")) {
  throw new Error("Use npm run test:isolated for Actions API tests.");
}
const requesterId = randomUUID(), otherId = randomUUID(), staffId = randomUUID(), adminId = randomUUID(), inactiveId = randomUUID(), workerId = randomUUID();
const ticketId = randomUUID(), foreignTicketId = randomUUID();
const url = `/api/staff/tickets/${ticketId}/actions`;
let staff = "", admin = "", requester = "", inactive = "";
const body = (extra = {}) => ({ clientRequestId: randomUUID(), actionDescription: " Checked configuration ", actionResult: " Awaiting verification ", followUpRequired: false, ...extra });
const create = (payload: object = body(), cookie = staff) => request(app).post(url).set("Cookie", cookie).send(payload);
const patch = (id: string, payload: object, cookie = admin) => request(app).patch(`${url}/${id}`).set("Cookie", cookie).send(payload);
const snapshot = async (id: string) => {
  const action = await prisma.actionTaken.findUniqueOrThrow({ where: { id } });
  return { action,
    revisions: await prisma.actionTakenRevision.findMany({ where: { actionId: id }, orderBy: { version: "asc" } }),
    ticket: await prisma.ticket.findUniqueOrThrow({ where: { id: action.ticketId } }),
  };
};
const audit = (state: Awaited<ReturnType<typeof snapshot>>, editorId: string) => {
  const keys = ["actionDescription", "actionResult", "followUpRequired", "followUpNote", "attachmentNotes", "assigneeId", "status", "version"] as const;
  const latest = state.revisions.at(-1)!;
  expect(state.revisions).toHaveLength(state.action.version);
  expect(latest.editorId).toBe(editorId);
  for (const key of keys) expect(latest[key], key).toEqual(state.action[key]);
};

// Real transactions/SQL; pause only after each explicit assignee lock succeeds.
// Neither writer may reach its FK inserts until both hold their reciprocal lock.
async function reciprocal(run: () => Promise<request.Response[]>) {
  const original = prisma.$transaction.bind(prisma);
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const timer = setTimeout(release, 3000);
  const implementation = (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => original(async tx => callback(new Proxy(tx, {
    get(target, key) {
      if (key !== "$queryRaw") return Reflect.get(target, key);
      return async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const result = await target.$queryRaw(strings, ...values);
        if (strings.join("").includes('FROM "User"')) {
          arrivals++;
          if (arrivals === 2) release();
          await gate;
          expect(arrivals, "Both assignee locks must arrive before FK writes").toBe(2);
        }
        return result;
      };
    },
  })), { timeout: 8000 });
  const spy = vi.spyOn(prisma, "$transaction").mockImplementation(implementation as typeof prisma.$transaction);
  try {
    const responses = await run();
    expect(arrivals).toBe(2);
    // Assert exact success, not merely absence of timeout/deadlock diagnostics.
    return responses;
  } finally { release(); clearTimeout(timer); spy.mockRestore(); }
}
beforeAll(async () => {
  await prisma.user.createMany({ data: [
    ...[requesterId, otherId].map(id => ({ id, name: "Action requester", email: `${id}@test.local`, role: "REQUESTER" as const, passwordHash: "private", mustChangePassword: false })),
    ...[staffId, inactiveId, workerId].map(id => ({ id, name: "Action staff", email: `${id}@test.local`, role: "IT_STAFF" as const, passwordHash: "private", mustChangePassword: false, isActive: id !== inactiveId })),
    { id: adminId, name: "Action admin", email: `${adminId}@test.local`, role: "ADMINISTRATOR", passwordHash: "private", mustChangePassword: false },
  ] });
  [staff, admin, requester, inactive] = await Promise.all([staffId, adminId, requesterId, inactiveId].map(requesterCookie));
  const category = await prisma.category.findFirstOrThrow(), system = await prisma.relatedSystem.findFirstOrThrow();
  await prisma.ticket.createMany({ data: [ticketId, foreignTicketId].map(id => ({ id, ticketNumber: `ACTION-${id}`, clientRequestId: randomUUID(), requesterId: id === ticketId ? requesterId : otherId, ownerId: adminId, categoryId: category.id, relatedSystemId: system.id, summary: "Action fixture", description: "Ticket description" })) });
});
afterAll(async () => {
  await prisma.actionTakenRevision.deleteMany({ where: { action: { ticketId: { in: [ticketId, foreignTicketId] } } } });
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: [ticketId, foreignTicketId] } } });
  await prisma.ticket.deleteMany({ where: { id: { in: [ticketId, foreignTicketId] } } });
  await prisma.session.deleteMany({ where: { userId: { in: [requesterId, otherId, staffId, adminId, inactiveId, workerId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [requesterId, otherId, staffId, adminId, inactiveId, workerId] } } });
});

describe("Issue #58 Actions Taken", () => {
  it.each([{ isActive: false }, { role: "REQUESTER" }])("rechecks eligibility after an actual Administrator account update %j wins the race", async change => {
    const action = (await create()).body.data;
    const before = await snapshot(action.id);
    const original = prisma.$transaction.bind(prisma);
    let release!: () => void, acquired!: (pid: number) => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const locked = new Promise<number>(resolve => { acquired = resolve; });
    const timer = setTimeout(release, 3000);
    const implementation = (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => original(async tx => callback(new Proxy(tx, {
      get(target, key) {
        if (key !== "user") return Reflect.get(target, key);
        return new Proxy(target.user, { get(users, operation) {
          if (operation !== "update") return Reflect.get(users, operation);
          return async (args: Parameters<typeof users.update>[0]) => {
            const result = await users.update(args);
            const [connection] = await target.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
            acquired(connection.pid);
            await gate;
            return result;
          };
        } });
      },
    })), { timeout: 8000 });
    const spy = vi.spyOn(prisma, "$transaction").mockImplementation(implementation as typeof prisma.$transaction);
    let update: Promise<request.Response> | undefined, assignment: Promise<request.Response> | undefined;
    try {
      update = Promise.resolve(request(app).patch(`/api/admin/users/${workerId}`).set("Cookie", admin).send(change).timeout({ deadline: 10000 }));
      const pid = await Promise.race([locked, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Administrator update never acquired its User lock")), 3000))]);
      assignment = Promise.resolve(patch(action.id, { expectedVersion: 1, assigneeId: workerId }, staff).timeout({ deadline: 10000 }));
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const [blocked] = await prisma.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))) AS waiting`;
        if (blocked.waiting) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting, "Assignment must actually wait for the Administrator's uncommitted User UPDATE").toBe(true);
      release();
      expect((await update).status).toBe(200);
      const rejected = await assignment;
      expect(rejected.status).toBe(400); expect(rejected.body.error.code).toBe("INVALID_ACTION_ASSIGNEE");
      expect(await snapshot(action.id)).toEqual(before);
    } finally {
      release(); clearTimeout(timer);
      await Promise.allSettled([update, assignment]); spy.mockRestore();
      await prisma.user.update({ where: { id: workerId }, data: { isActive: true, role: "IT_STAFF" } });
    }
  });
  it("stores independently expected complete snapshots at every lifecycle step", async () => {
    const action = (await create(body({ followUpRequired: true, followUpNote: "Plan", attachmentNotes: "Evidence" }))).body.data;
    let expected = { actionDescription: "Checked configuration", actionResult: "Awaiting verification", followUpRequired: true, followUpNote: "Plan", attachmentNotes: "Evidence", assigneeId: staffId, status: "PENDING", version: 1, editorId: staffId };
    const check = async () => {
      const state = await snapshot(action.id);
      expect(state.revisions.at(-1)).toMatchObject(expected);
      audit(state, expected.editorId);
      return state.revisions;
    };
    let history = await check();
    for (const [change, cookie, editorId] of [
      [{ actionDescription: "Edited", actionResult: "Retested", followUpNote: "Updated plan", attachmentNotes: "New evidence" }, admin, adminId],
      [{ assigneeId: workerId }, admin, adminId],
      [{ status: "COMPLETED" }, staff, staffId],
      [{ followUpRequired: false, followUpNote: "Verified successfully", attachmentNotes: null }, admin, adminId],
    ] as const) {
      expect((await patch(action.id, { expectedVersion: expected.version, ...change }, cookie)).status).toBe(200);
      expected = { ...expected, ...change, version: expected.version + 1, editorId } as typeof expected;
      const next = await check();
      expect(next.slice(0, -1)).toEqual(history); history = next;
    }
    expect(history[3]).toMatchObject({ status: "COMPLETED", editorId: staffId });
  });
  it.each(["creation", "reassignment", "completion"])("avoids reciprocal User FK deadlocks during %s on distinct Tickets", async operation => {
    const otherUrl = `/api/staff/tickets/${foreignTicketId}/actions`;
    try {
      let first: string, second: string;
      if (operation !== "creation") {
        first = (await create(body({ assigneeId: operation === "completion" ? adminId : staffId }))).body.data.id;
        second = (await request(app).post(otherUrl).set("Cookie", admin).send(body({ assigneeId: operation === "completion" ? staffId : adminId }))).body.data.id;
      }
      const responses = await reciprocal(() => Promise.all(operation === "creation" ? [
        create(body({ assigneeId: adminId })).timeout({ deadline: 10000 }),
        request(app).post(otherUrl).set("Cookie", admin).send(body({ assigneeId: staffId })).timeout({ deadline: 10000 }),
      ] : [
        patch(first!, { expectedVersion: 1, ...(operation === "completion" ? { status: "COMPLETED" } : { assigneeId: adminId }) }, staff).timeout({ deadline: 10000 }),
        request(app).patch(`${otherUrl}/${second!}`).set("Cookie", admin).send({ expectedVersion: 1, ...(operation === "completion" ? { status: "COMPLETED" } : { assigneeId: staffId }) }).timeout({ deadline: 10000 }),
      ]));
      expect(responses.map(response => ({ status: response.status, error: response.body.error }))).toEqual(Array(2).fill({ status: operation === "creation" ? 201 : 200, error: undefined }));
      for (const [index, response] of responses.entries()) {
        const state = await snapshot(response.body.data.id);
        audit(state, index === 0 ? staffId : adminId);
        expect(state.action.version).toBe(operation === "creation" ? 1 : 2);
        expect(state.action.assigneeId).toBe(index === 0 ? adminId : staffId);
      }
    } finally {
      await prisma.actionTakenRevision.deleteMany({ where: { action: { ticketId: foreignTicketId } } });
      await prisma.actionTaken.deleteMany({ where: { ticketId: foreignTicketId } });
    }
  });
  it.each(["actionDescription", "actionResult", "followUpNote", "attachmentNotes"])("rejects NUL in %s without any create or PATCH writes", async key => {
    const action = (await create()).body.data;
    const before = await snapshot(action.id);
    const count = await prisma.actionTaken.count({ where: { ticketId } });
    for (const response of [await create(body({ [key]: "a\u0000b" })), await patch(action.id, { expectedVersion: 1, [key]: "a\u0000b" })]) {
      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { [key]: "NUL characters are not permitted." } });
      expect(await snapshot(action.id)).toEqual(before);
      expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(count);
    }
  });
  it("enforces sessions, roles and owned requester reads before disclosure", async () => {
    expect((await request(app).get(url)).status).toBe(401);
    expect((await create(body(), inactive)).status).toBe(401);
    expect((await create(body(), requester)).status).toBe(403);
    expect((await patch(randomUUID(), { expectedVersion: 1, status: "COMPLETED" }, requester)).status).toBe(403);
    expect((await request(app).get(url).set("Cookie", requester)).status).toBe(403);
    expect((await request(app).get(`/api/tickets/${ticketId}/actions`).set("Cookie", staff)).status).toBe(403);
    const foreign = await request(app).get(`/api/tickets/${foreignTicketId}/actions`).set("Cookie", requester);
    const missing = await request(app).get(`/api/tickets/${randomUUID()}/actions`).set("Cookie", requester);
    expect(foreign.status).toBe(404); expect(foreign.body).toEqual(missing.body);
    await prisma.user.update({ where: { id: staffId }, data: { mustChangePassword: true } });
    expect((await create()).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    await prisma.user.update({ where: { id: staffId }, data: { mustChangePassword: false } });
  });
  it("creates trimmed shared records, server identity/date, full revision 1 and one parent increment", async () => {
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const response = await create(body({ assigneeId: workerId, followUpRequired: true, followUpNote: " Test again ", attachmentNotes: " screenshot.png " }));
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ ticketId, performedBy: { id: staffId }, assignee: { id: workerId, isActive: true }, status: "PENDING", version: 1, actionDescription: "Checked configuration", followUpNote: "Test again", attachmentNotes: "screenshot.png" });
    expect(response.body.data.actionDateTime).toBe(response.body.data.createdAt);
    const saved = await snapshot(response.body.data.id);
    audit(saved, staffId);
    expect(saved.revisions).toHaveLength(1);
    expect(saved.revisions[0]).toMatchObject({ editorId: staffId, version: 1, assigneeId: workerId, status: "PENDING", actionResult: saved.action.actionResult });
    expect(saved.ticket.workflowVersion).toBe(before.workflowVersion + 1);
    expect(saved.ticket.ownerId).toBe(adminId);
    expect(saved.ticket.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|email|clientRequestId|editorId|revisions|session/);
    const defaulted = await create(body(), admin);
    expect(defaulted.status).toBe(201); expect(defaulted.body.data.assignee.id).toBe(adminId);
  });
  it.each([
    { actionDescription: " " }, { actionDescription: null }, { actionResult: 1 }, { actionResult: "x".repeat(2001) },
    { followUpRequired: "false" }, { followUpRequired: null }, { followUpRequired: true },
    { followUpNote: [] }, { attachmentNotes: "x".repeat(2001) }, { clientRequestId: "bad" },
    { performedById: requesterId }, { createdAt: new Date().toISOString() }, { status: "COMPLETED" },
    { editorId: adminId }, { ticketId: foreignTicketId }, { version: 9 }, { ownerId: staffId }, { surprise: true },
  ])("rejects invalid/forbidden create input %j without writes", async extra => {
    const before = await prisma.actionTaken.count({ where: { ticketId } });
    const response = await create(body(extra));
    expect(response.status).toBe(400); expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toBeTruthy();
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(before);
  });
  it.each([null, "", "bad", requesterId, inactiveId, randomUUID()])("rejects ineligible create/reassign assignee %s", async assigneeId => {
    expect((await create(body({ assigneeId }))).body.error.code).toBe("INVALID_ACTION_ASSIGNEE");
    const action = (await create()).body.data;
    const before = await snapshot(action.id);
    const result = await patch(action.id, { expectedVersion: 1, assigneeId });
    expect(result.status).toBe(400); expect(result.body.error.fields.assigneeId).toBeTruthy();
    expect(await snapshot(action.id)).toEqual(before);
  });
  it("preserves all earlier revisions, performer/date and actual transition actor through combined writes", async () => {
    const action = (await create(body({ followUpRequired: true, followUpNote: "Initial plan" }))).body.data;
    const initial = await snapshot(action.id);
    const completed = await patch(action.id, { expectedVersion: 1, assigneeId: adminId, status: "COMPLETED", actionResult: "Verified" });
    expect(completed.status).toBe(200); expect(completed.body.data.version).toBe(2);
    const firstTerminal = await snapshot(action.id);
    audit(firstTerminal, adminId);
    expect(firstTerminal.revisions[1]).toMatchObject({ status: "COMPLETED", editorId: adminId });
    for (const followUpNote of [undefined, null, " ", " Initial plan "]) {
      const beforeRejected = await snapshot(action.id);
      const response = await patch(action.id, { expectedVersion: 2, followUpRequired: false, ...(followUpNote !== undefined ? { followUpNote } : {}) });
      expect(response.status).toBe(400); expect(response.body.error.fields.followUpNote).toBeTruthy();
      expect(await snapshot(action.id)).toEqual(beforeRejected);
    }
    const beforeCorrection = await snapshot(action.id);
    expect((await patch(action.id, { expectedVersion: 2, followUpRequired: false, followUpNote: "Requester retested successfully" }, staff)).status).toBe(200);
    const after = await snapshot(action.id);
    audit(after, staffId);
    expect(after.revisions.slice(0, 2)).toEqual(beforeCorrection.revisions);
    expect(after.revisions[0]).toEqual(initial.revisions[0]);
    expect(after.revisions.map(r => [r.version, r.editorId])).toEqual([[1, staffId], [2, adminId], [3, staffId]]);
    expect(after.action.createdAt).toEqual(initial.action.createdAt); expect(after.action.performedById).toBe(staffId);
    expect(after.ticket.workflowVersion).toBe(initial.ticket.workflowVersion + 2);
    for (const change of [{ status: "COMPLETED" }, { status: "PENDING" }, { status: "CANCELLED" }, { assigneeId: adminId }]) {
      expect((await patch(action.id, { expectedVersion: 3, ...change })).body.error.code).toBe("ACTION_STATE_CONFLICT");
    }
    expect(await snapshot(action.id)).toEqual(after);
  });
  it("requires explicit cancellation result; retains inactive historical assignee and permits corrections/cancellation", async () => {
    const action = (await create(body({ assigneeId: adminId }))).body.data;
    await prisma.user.update({ where: { id: adminId }, data: { isActive: false } });
    try {
      expect((await patch(action.id, { expectedVersion: 1, status: "COMPLETED" }, staff)).body.error.code).toBe("INVALID_ACTION_ASSIGNEE");
      expect((await patch(action.id, { expectedVersion: 1, assigneeId: adminId }, staff)).status).toBe(400);
      expect((await patch(action.id, { expectedVersion: 1, actionDescription: "Correction" }, staff)).status).toBe(200);
      audit(await snapshot(action.id), staffId);
      expect((await patch(action.id, { expectedVersion: 2, status: "CANCELLED" }, staff)).status).toBe(400);
      const cancelled = await patch(action.id, { expectedVersion: 2, status: "CANCELLED", actionResult: "Duplicate task" }, staff);
      expect(cancelled.status).toBe(200); expect(cancelled.body.data.assignee.isActive).toBe(false);
      const firstTerminal = await snapshot(action.id);
      audit(firstTerminal, staffId);
      const cancelledSnapshot = { actionDescription: "Correction", actionResult: "Duplicate task", followUpRequired: false, followUpNote: null, attachmentNotes: null, assigneeId: adminId, status: "CANCELLED", version: 3, editorId: staffId };
      expect(firstTerminal.revisions[2]).toMatchObject(cancelledSnapshot);
      expect((await patch(action.id, { expectedVersion: 3, attachmentNotes: "Retained evidence" }, staff)).status).toBe(200);
      const corrected = await snapshot(action.id);
      audit(corrected, staffId);
      expect(corrected.revisions[3]).toMatchObject({ ...cancelledSnapshot, attachmentNotes: "Retained evidence", version: 4 });
      expect(corrected.revisions.slice(0, 3)).toEqual(firstTerminal.revisions);
    } finally { await prisma.user.update({ where: { id: adminId }, data: { isActive: true } }); }
  });
  it("rejects stale versions including no-ops and permits only one simultaneous mutation", async () => {
    const action = (await create()).body.data;
    const before = await snapshot(action.id);
    expect((await patch(action.id, { expectedVersion: 1, actionResult: action.actionResult })).status).toBe(200);
    expect(await snapshot(action.id)).toEqual(before);
    const results = await Promise.all([
      patch(action.id, { expectedVersion: 1, assigneeId: adminId, status: "COMPLETED" }),
      patch(action.id, { expectedVersion: 1, status: "CANCELLED", actionResult: "Cancelled" }, staff),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const after = await snapshot(action.id);
    expect(after.revisions).toHaveLength(2); expect(after.action.version).toBe(2);
    expect(after.ticket.workflowVersion).toBe(before.ticket.workflowVersion + 1);
    expect((await patch(action.id, { expectedVersion: 1, actionResult: after.action.actionResult })).body.error.code).toBe("CONFLICT");
    expect(await snapshot(action.id)).toEqual(after);
  });
  it("audits standalone reassignment and recovers inactive work without changing original identities", async () => {
    const action = (await create(body({ assigneeId: workerId }))).body.data;
    const initial = await snapshot(action.id);
    expect((await patch(action.id, { expectedVersion: 1, assigneeId: workerId })).status).toBe(200);
    expect(await snapshot(action.id)).toEqual(initial);
    await prisma.user.update({ where: { id: workerId }, data: { isActive: false } });
    try {
      expect((await patch(action.id, { expectedVersion: 1, status: "COMPLETED" })).status).toBe(400);
      expect((await patch(action.id, { expectedVersion: 1, assigneeId: adminId })).status).toBe(200);
      audit(await snapshot(action.id), adminId);
      expect((await patch(action.id, { expectedVersion: 2, status: "COMPLETED" }, staff)).status).toBe(200);
      audit(await snapshot(action.id), staffId);
      const after = await snapshot(action.id);
      expect(after.revisions[0]).toEqual(initial.revisions[0]);
      expect(after.revisions.map(r => [r.version, r.assigneeId, r.editorId])).toEqual([[1, workerId, staffId], [2, adminId, adminId], [3, adminId, staffId]]);
      expect(after.action.performedById).toBe(staffId); expect(after.action.createdAt).toEqual(initial.action.createdAt);
      expect(after.ticket.ownerId).toBe(initial.ticket.ownerId);
    } finally { await prisma.user.update({ where: { id: workerId }, data: { isActive: true } }); }
  });
  it.each(["PENDING", "COMPLETED", "CANCELLED"].flatMap(from => ["PENDING", "COMPLETED", "CANCELLED"].map(to => [from, to]))) ("enforces Action transition %s -> %s", async (from, to) => {
    const action = (await create()).body.data;
    let version = 1;
    if (from !== "PENDING") {
      expect((await patch(action.id, { expectedVersion: 1, status: from, actionResult: "Outcome or cancellation reason" })).status).toBe(200);
      version++;
    }
    const before = await snapshot(action.id);
    const allowed = from === "PENDING" && to !== "PENDING";
    const response = await patch(action.id, { expectedVersion: version, status: to, actionResult: "Outcome or reason" });
    expect(response.status).toBe(allowed ? 200 : 409);
    if (!allowed) expect(await snapshot(action.id)).toEqual(before);
  });
  it("replays normalized revision 1 after edits/deactivation/parent cancellation without writes", async () => {
    const payload = body({ assigneeId: adminId });
    const action = (await create(payload)).body.data;
    await patch(action.id, { expectedVersion: 1, assigneeId: staffId, status: "COMPLETED", actionResult: "Done" });
    await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus: "Cancelled" } });
    await prisma.user.update({ where: { id: adminId }, data: { isActive: false } });
    try {
      const before = await snapshot(action.id);
      const replay = await create({ ...payload, actionDescription: payload.actionDescription.trim(), attachmentNotes: " " });
      expect(replay.status).toBe(200); expect(replay.headers["idempotent-replay"]).toBe("true");
      expect(replay.body.data.id).toBe(action.id); expect(replay.body.data.actionResult).toBe("Done");
      expect((await create({ ...payload, assigneeId: staffId })).body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      expect((await create({ ...payload, actionResult: "Different" })).status).toBe(409);
      expect(await snapshot(action.id)).toEqual(before);
    } finally {
      await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus: "New" } });
      await prisma.user.update({ where: { id: adminId }, data: { isActive: true } });
    }
  });
  it("serializes concurrent identical/conflicting creation intents", async () => {
    const payload = body();
    const results = await Promise.all([create(payload), create(payload)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 201]);
    expect(results[0].body.data.id).toBe(results[1].body.data.id);
    expect((await snapshot(results[0].body.data.id)).revisions).toHaveLength(1);
    const conflict = body();
    const reused = await Promise.all([create(conflict), create({ ...conflict, actionResult: "Other intent" })]);
    expect(reused.map(r => r.status).sort()).toEqual([201, 409]);
  });
  it("validates paths, query, JSON, patch types and resource association safely", async () => {
    expect((await request(app).get("/api/staff/tickets/bad/actions").set("Cookie", staff)).status).toBe(400);
    expect((await request(app).get(`/api/staff/tickets/${randomUUID()}/actions`).set("Cookie", staff)).body.error.code).toBe("TICKET_NOT_FOUND");
    expect((await patch(randomUUID(), { expectedVersion: 1, actionResult: "x" })).body.error.code).toBe("ACTION_NOT_FOUND");
    const action = (await create()).body.data;
    expect((await request(app).patch(`/api/staff/tickets/${foreignTicketId}/actions/${action.id}`).set("Cookie", staff).send({ expectedVersion: 1, actionResult: "x" })).body.error.code).toBe("ACTION_NOT_FOUND");
    for (const value of [{}, [], { expectedVersion: 1 }, { expectedVersion: "1", actionResult: "x" }, { expectedVersion: 0, actionResult: "x" }, { expectedVersion: 1, status: "BAD" }, { expectedVersion: 1, followUpRequired: true }, { expectedVersion: 1, clientRequestId: randomUUID(), actionResult: "x" }]) {
      expect((await patch(action.id, value)).status).toBe(400);
    }
    expect((await request(app).post(url).set("Cookie", staff).set("Content-Type", "application/json").send('{"bad":')).status).toBe(400);
    for (const query of ["page=0", "page=1.5", "pageSize=11", "page=1&page=2", "sort=desc", "focusActionId=bad", `page=1&focusActionId=${action.id}`]) {
      expect((await request(app).get(`${url}?${query}`).set("Cookie", staff)).body.error.code).toBe("INVALID_QUERY_PARAMS");
    }
    expect((await request(app).get(`${url}?focusActionId=${randomUUID()}`).set("Cookie", staff)).body.error.code).toBe("ACTION_NOT_FOUND");
    expect((await request(app).delete(`${url}/${action.id}`).set("Cookie", staff)).status).toBe(404);
  });
  it("enforces active parent policy without changing Ticket status or cascading child state", async () => {
    const action = (await create()).body.data;
    for (const currentStatus of ["Resolved", "Closed", "Cancelled"] as const) {
      await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus } });
      const before = await snapshot(action.id);
      expect((await create()).body.error.code).toBe("TICKET_WORKFLOW_CONFLICT");
      expect((await patch(action.id, { expectedVersion: 1, assigneeId: staffId })).body.error.code).toBe("TICKET_WORKFLOW_CONFLICT");
      expect(await snapshot(action.id)).toEqual(before);
    }
    try {
      expect((await patch(action.id, { expectedVersion: 1, status: "CANCELLED", actionResult: "Parent cancelled; task no longer needed" })).status).toBe(200);
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).currentStatus).toBe("Cancelled");
    } finally { await prisma.ticket.update({ where: { id: ticketId }, data: { currentStatus: "New" } }); }
  });
  it("guards resolved/closed content corrections using the post-write gate", async () => {
    const id = randomUUID();
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    await prisma.ticket.create({ data: { id, ticketNumber: `TERMINAL-${id}`, clientRequestId: randomUUID(), requesterId, categoryId: ticket.categoryId, relatedSystemId: ticket.relatedSystemId, summary: "Gate fixture", description: "Gate fixture" } });
    const path = `/api/staff/tickets/${id}/actions`;
    try {
      const action = (await request(app).post(path).set("Cookie", staff).send(body())).body.data;
      expect((await request(app).patch(`${path}/${action.id}`).set("Cookie", admin).send({ expectedVersion: 1, status: "COMPLETED" })).status).toBe(200);
      for (const currentStatus of ["Resolved", "Closed"] as const) {
        await prisma.ticket.update({ where: { id }, data: { currentStatus } });
        const before = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
        const revisions = await prisma.actionTakenRevision.findMany({ where: { actionId: action.id }, orderBy: { version: "asc" } });
        const rejected = await request(app).patch(`${path}/${action.id}`).set("Cookie", staff).send({ expectedVersion: before.version, followUpRequired: true, followUpNote: "New unresolved work" });
        expect(rejected.body.error.code).toBe("TICKET_WORKFLOW_CONFLICT");
        expect(await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).toEqual(before);
        expect(await prisma.actionTakenRevision.findMany({ where: { actionId: action.id }, orderBy: { version: "asc" } })).toEqual(revisions);
        const valid = await request(app).patch(`${path}/${action.id}`).set("Cookie", staff).send({ expectedVersion: before.version, actionResult: `Evidence corrected on ${currentStatus}` });
        expect(valid.status).toBe(200);
        expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).currentStatus).toBe(currentStatus);
      }
    } finally {
      await prisma.actionTakenRevision.deleteMany({ where: { action: { ticketId: id } } });
      await prisma.actionTaken.deleteMany({ where: { ticketId: id } });
      await prisma.ticket.delete({ where: { id } });
    }
  });
  it("serializes assignment/completion with assignee deactivation and role-change commits", async () => {
    for (const operation of ["assignment", "completion"] as const) {
      const action = (await create(body(operation === "completion" ? { assigneeId: adminId } : {}))).body.data;
      const before = await snapshot(action.id);
      let pending: Promise<request.Response> | undefined;
      try {
        await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${adminId} FOR UPDATE`;
          const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          pending = Promise.resolve(patch(action.id, { expectedVersion: 1, ...(operation === "assignment" ? { assigneeId: adminId } : { status: "COMPLETED" }) }, staff));
          let waiting = false;
          for (let attempt = 0; attempt < 100; attempt++) {
            const [blocked] = await tx.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${connection.pid} = ANY(pg_blocking_pids(pid))) AS waiting`;
            if (blocked.waiting) { waiting = true; break; }
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          expect(waiting).toBe(true);
          await tx.user.update({ where: { id: adminId }, data: operation === "assignment" ? { isActive: false } : { role: "REQUESTER" } });
        });
        const response = await pending!;
        expect(response.status).toBe(400); expect(response.body.error.code).toBe("INVALID_ACTION_ASSIGNEE");
        expect(await snapshot(action.id)).toEqual(before);
      } finally {
        if (pending) await pending;
        await prisma.user.update({ where: { id: adminId }, data: { isActive: true, role: "ADMINISTRATOR" } });
      }
    }
  });
  it("paginates all states with deterministic tied ordering and staff focus; requester alias is safe", async () => {
    const all = await prisma.actionTaken.findMany({ where: { ticketId }, orderBy: { id: "asc" } });
    await prisma.actionTaken.updateMany({ where: { ticketId }, data: { createdAt: new Date("2026-01-01T00:00:00Z") } });
    const response = await request(app).get(`${url}?pageSize=10&focusActionId=${all[10].id}`).set("Cookie", admin);
    expect(response.status).toBe(200); expect(response.body.meta.page).toBe(2);
    expect(response.body.data.map((a: { id: string }) => a.id)).toEqual(all.slice(10, 20).map(a => a.id));
    const own = await request(app).get(`/api/v1/tickets/${ticketId}/actions?pageSize=50`).set("Cookie", requester);
    expect(own.status).toBe(200); expect(own.body.meta.totalItems).toBe(all.length);
    expect(new Set(own.body.data.map((a: { status: string }) => a.status))).toEqual(new Set(["PENDING", "COMPLETED", "CANCELLED"]));
    expect(JSON.stringify(own.body)).not.toMatch(/passwordHash|email|editorId|revisions|internalNotes|clientRequestId/);
    expect((await request(app).get(`${url}?page=999`).set("Cookie", staff)).body.data).toEqual([]);
    expect((await request(app).get(`/api/tickets/${ticketId}/actions?focusActionId=${all[0].id}`).set("Cookie", requester)).status).toBe(400);
    const empty = await request(app).get(`/api/staff/tickets/${foreignTicketId}/actions`).set("Cookie", staff);
    expect(empty.body).toEqual({ data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });
  });
  it("rolls back projection/revision/parent on injected late database failure and returns safe errors", async () => {
    const action = (await create()).body.data;
    const before = await snapshot(action.id);
    // A trigger faults the final parent write, after projection/revision writes.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION issue58_fail_parent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${ticketId}' THEN RAISE EXCEPTION 'private database diagnostic'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER issue58_fail_parent BEFORE UPDATE ON "Ticket" FOR EACH ROW EXECUTE FUNCTION issue58_fail_parent()');
    try {
      const edit = await patch(action.id, { expectedVersion: 1, actionResult: "Failed edit" });
      expect(edit.status).toBe(500); expect(JSON.stringify(edit.body)).not.toMatch(/private|SQL|stack|prisma/i);
      const count = await prisma.actionTaken.count({ where: { ticketId } });
      expect((await create()).status).toBe(500);
      expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(count);
      expect(await snapshot(action.id)).toEqual(before);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER issue58_fail_parent ON "Ticket"');
      await prisma.$executeRawUnsafe('DROP FUNCTION issue58_fail_parent()');
    }
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("secret"));
    try { expect((await request(app).get(url).set("Cookie", staff)).body).toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to complete the request." } }); }
    finally { spy.mockRestore(); }
  });
});
