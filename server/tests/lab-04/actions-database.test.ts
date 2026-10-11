import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ActionStatus } from "@prisma/client";
import { seed } from "../../prisma/seed.js";
import { applyMigration, migrationNames, withDatabaseFixture } from "../lab-03/databaseFixture.js";

describe("Issue 57 action database constraints", () => {
  it("supports independent identities, defaults, multiple actions, retained snapshots and restrictive FKs", async () => {
    await withDatabaseFixture(async prisma => {
      for (const name of await migrationNames()) await applyMigration(prisma, name);
      await seed(prisma, { lab4: false });
      const ticket = await prisma.ticket.findFirstOrThrow({ where: { ownerId: { not: null } } });
      const performer = await prisma.user.findUniqueOrThrow({ where: { email: "staff2@example.com" } });
      const assignee = await prisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
      const editor = await prisma.user.findUniqueOrThrow({ where: { email: "staff3@example.com" } });
      const data = { ticketId: ticket.id, performedById: performer.id, assigneeId: assignee.id,
        actionDescription: "Collected wireless logs", actionResult: "Awaiting verification", clientRequestId: randomUUID() };
      const action = await prisma.actionTaken.create({ data, include: { ticket: true, performedBy: true, assignee: true } });
      expect(action).toMatchObject({ status: "PENDING", version: 1, followUpRequired: false, followUpNote: null, attachmentNotes: null });
      expect(action.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(action.createdAt).toBeInstanceOf(Date);
      expect(action.updatedAt).toBeInstanceOf(Date);
      expect(action.ticket.workflowVersion).toBe(0);
      expect(new Set([action.ticket.ownerId, action.performedBy.id, action.assignee.id]).size).toBe(3);
      const snapshot = { actionId: action.id, editorId: performer.id, version: 1,
        assigneeId: assignee.id, status: action.status, actionDescription: action.actionDescription,
        actionResult: action.actionResult, followUpRequired: false, followUpNote: null, attachmentNotes: null };
      const first = await prisma.actionTakenRevision.create({ data: snapshot });
      // Database foundation permits this transaction; later services must enforce
      // authenticated editor, transition policy, locking and parent version updates.
      await prisma.$transaction(async tx => {
        await tx.actionTaken.update({ where: { id: action.id }, data: { actionResult: "Verified restored connection", status: "COMPLETED", version: 2 } });
        await tx.actionTakenRevision.create({ data: { ...snapshot, editorId: editor.id, version: 2, status: "COMPLETED", actionResult: "Verified restored connection" } });
      });
      const history = await prisma.actionTakenRevision.findMany({ where: { actionId: action.id }, orderBy: { version: "asc" }, include: { editor: true, assignee: true, action: true } });
      expect(history.map(row => row.version)).toEqual([1, 2]);
      expect(history[1].editor.id).toBe(editor.id);
      expect(history[0].assignee.id).toBe(assignee.id);
      expect(history[1].action.performedById).toBe(performer.id);
      expect(history[1].action.createdAt).toEqual(action.createdAt);
      expect(await prisma.actionTakenRevision.findUnique({ where: { id: first.id } })).toEqual(first);
      await expect(prisma.actionTaken.create({ data })).rejects.toMatchObject({ code: "P2002" });
      await expect(prisma.actionTakenRevision.create({ data: snapshot })).rejects.toMatchObject({ code: "P2002" });
      // The same key is allowed for a different performer and a different ticket.
      await prisma.actionTaken.create({ data: { ...data, performedById: editor.id } });
      const other = await prisma.ticket.findFirstOrThrow({ where: { id: { not: ticket.id } } });
      await prisma.actionTaken.create({ data: { ...data, ticketId: other.id } });
      for (const status of Object.values(ActionStatus)) {
        await prisma.actionTaken.create({ data: { ...data, clientRequestId: randomUUID(), status } });
      }
      expect(Object.values(ActionStatus)).toEqual(["PENDING", "COMPLETED", "CANCELLED"]);
      expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(5);
      for (const field of ["ticketId", "performedById", "assigneeId"] as const) {
        await expect(prisma.actionTaken.create({ data: { ...data, clientRequestId: randomUUID(), [field]: randomUUID() } })).rejects.toMatchObject({ code: "P2003" });
      }
      for (const field of ["actionId", "editorId", "assigneeId"] as const) {
        await expect(prisma.actionTakenRevision.create({ data: { ...snapshot, version: 3, [field]: randomUUID() } })).rejects.toMatchObject({ code: "P2003" });
      }
      // PostgreSQL RESTRICT returns SQLSTATE 23001 on this installation; Prisma
      // 5 reports it as an unknown request error rather than mapping to P2003.
      await expect(prisma.ticket.delete({ where: { id: ticket.id } })).rejects.toThrow(/foreign key constraint/);
      await expect(prisma.actionTaken.delete({ where: { id: action.id } })).rejects.toThrow(/foreign key constraint/);
      for (const id of [performer.id, assignee.id, editor.id]) {
        await expect(prisma.user.delete({ where: { id } })).rejects.toThrow(/foreign key constraint/);
      }
      const historicWorker = await prisma.user.create({ data: { name: "Historical assignee", email: "historical-assignee@example.com", role: "IT_STAFF", isActive: false, passwordHash: "test-only" } });
      const historicEditor = await prisma.user.create({ data: { name: "Historical editor", email: "historical-editor@example.com", role: "IT_STAFF", passwordHash: "test-only" } });
      // Separate PENDING action: valid historical assignment followed by an
      // atomic reassignment. No terminal reversal or projection/version mismatch.
      const { actionId: originalParentId, ...initialRevision } = snapshot;
      const fkAction = await prisma.actionTaken.create({ data: { ...data, clientRequestId: randomUUID(), assigneeId: historicWorker.id,
        revisions: { create: { ...initialRevision, assigneeId: historicWorker.id } } } });
      const fkFirst = await prisma.actionTakenRevision.findFirstOrThrow({ where: { actionId: fkAction.id } });
      const third = await prisma.$transaction(async tx => {
        await tx.actionTaken.update({ where: { id: fkAction.id }, data: { assigneeId: assignee.id, version: 2 } });
        return tx.actionTakenRevision.create({ data: { ...snapshot, actionId: fkAction.id, version: 2, editorId: historicEditor.id } });
      });
      expect(await prisma.actionTaken.findUnique({ where: { id: fkAction.id } })).toMatchObject({ status: "PENDING", version: 2, assigneeId: assignee.id });
      expect(await prisma.actionTakenRevision.findUnique({ where: { id: fkFirst.id } })).toEqual(fkFirst);
      // These two users are referenced only by a revision, not a current action.
      await expect(prisma.user.delete({ where: { id: historicWorker.id } })).rejects.toThrow(/ActionTakenRevision_assigneeId_fkey/);
      await expect(prisma.user.delete({ where: { id: historicEditor.id } })).rejects.toThrow(/ActionTakenRevision_editorId_fkey/);
      expect(await prisma.actionTakenRevision.findUnique({ where: { id: third.id } })).toEqual(third);
      for (const column of ["actionId", "editorId", "version", "actionDescription", "actionResult", "followUpRequired", "assigneeId", "status", "createdAt"]) {
        await expect(prisma.$executeRawUnsafe(`UPDATE "ActionTakenRevision" SET "${column}" = NULL WHERE "id" = $1`, third.id)).rejects.toThrow();
      }
      expect(await prisma.actionTakenRevision.findUnique({ where: { id: first.id } })).toEqual(first);
      // Raw SQL proves requiredness/defaults are PostgreSQL constraints rather
      // than just generated-client argument validation.
      await prisma.$executeRaw`INSERT INTO "ActionTaken" ("id", "ticketId", "performedById", "assigneeId", "actionDescription", "actionResult", "clientRequestId", "updatedAt") VALUES ('raw-default', ${ticket.id}, ${performer.id}, ${assignee.id}, 'Inspect', 'Waiting', 'raw-default', CURRENT_TIMESTAMP)`;
      expect(await prisma.actionTaken.findUnique({ where: { id: "raw-default" } })).toMatchObject({ status: "PENDING", version: 1, followUpRequired: false });
      for (const column of ["ticketId", "performedById", "assigneeId", "actionDescription", "actionResult", "clientRequestId", "updatedAt"]) {
        await expect(prisma.$executeRawUnsafe(`UPDATE "ActionTaken" SET "${column}" = NULL WHERE "id" = 'raw-default'`)).rejects.toThrow();
      }
      await expect(prisma.$executeRawUnsafe(`UPDATE "ActionTaken" SET "status" = 'INVALID' WHERE "id" = 'raw-default'`)).rejects.toThrow();
    });
  }, 30000);
});
