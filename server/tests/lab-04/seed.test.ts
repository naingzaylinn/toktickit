import { describe, expect, it } from "vitest";
import { seed } from "../../prisma/seed.js";
import { LAB4_STATUSES } from "../../prisma/seed-lab4.js";
import { randomUUID } from "node:crypto";
import { applyMigration, migrationNames, withDatabaseFixture } from "../lab-03/databaseFixture.js";

describe("Issue 57 non-overwriting demonstration seed", () => {
  it("covers workflow/action distributions and retains every row after human edits and repeated runs", async () => {
    await withDatabaseFixture(async prisma => {
      for (const name of await migrationNames()) await applyMigration(prisma, name);
      await seed(prisma);
      const tickets = await prisma.ticket.findMany({ include: { actionsTaken: { include: { revisions: true } } } });
      expect(tickets).toHaveLength(12);
      expect(new Set(tickets.map(t => t.currentStatus))).toEqual(new Set(LAB4_STATUSES));
      expect(new Set(tickets.map(t => t.itPriority)).size).toBe(4);
      expect(tickets.some(t => t.ownerId === null)).toBe(true);
      expect(tickets.some(t => t.ownerId !== null)).toBe(true);
      for (const count of [0, 1, 2]) expect(tickets.some(t => t.actionsTaken.length === count)).toBe(true);
      const actions = await prisma.actionTaken.findMany({ include: { assignee: true } });
      expect(new Set(actions.map(a => a.status))).toEqual(new Set(["PENDING", "COMPLETED", "CANCELLED"]));
      expect(actions.some(a => !a.assignee.isActive)).toBe(true);
      expect(actions.some(a => a.assignee.isActive)).toBe(true);
      expect(actions.some(a => a.followUpRequired && a.status === "COMPLETED")).toBe(true);
      expect(actions.some(a => !a.followUpRequired)).toBe(true);
      expect(actions.some(a => a.attachmentNotes !== null)).toBe(true);
      expect(actions.some(a => a.attachmentNotes === null)).toBe(true);
      expect(tickets.some(t => t.ownerId && t.actionsTaken.some(a => new Set([t.ownerId, a.performedById, a.assigneeId]).size === 3))).toBe(true);
      for (const t of tickets.filter(t => ["Resolved", "Closed"].includes(t.currentStatus))) {
        expect(t.actionsTaken.some(a => a.status === "COMPLETED" && a.actionResult.trim())).toBe(true);
        expect(t.actionsTaken.some(a => a.status === "PENDING" || (a.status === "COMPLETED" && a.followUpRequired))).toBe(false);
      }
      const users = await prisma.user.findMany({ include: { tickets: true, performedActions: true } });
      expect(users.some(u => u.role === "REQUESTER" && u.isActive && u.tickets.length === 0)).toBe(true);
      expect(users.some(u => u.role === "REQUESTER" && u.tickets.length > 0)).toBe(true);
      expect(users.some(u => u.isActive && u.role === "IT_STAFF" && u.performedActions.length === 0)).toBe(true);
      for (const a of actions) {
        const revisions = await prisma.actionTakenRevision.findMany({ where: { actionId: a.id }, orderBy: { version: "asc" } });
        expect(revisions.map(r => r.version)).toEqual([1, 2]);
        expect(revisions[0]).toMatchObject({ editorId: a.performedById, status: "PENDING" });
        for (const field of ["actionDescription", "actionResult", "followUpRequired", "followUpNote", "attachmentNotes", "assigneeId", "status"] as const) expect(revisions[1][field]).toEqual(a[field]);
      }
      const edited = actions.find(a => a.status === "PENDING" && a.assignee.isActive)!;
      const editor = users.find(u => u.email === "staff1@example.com")!;
      await prisma.$transaction(async tx => {
        const projection = await tx.actionTaken.update({ where: { id: edited.id }, data: { actionResult: "Human cancellation reason", status: "CANCELLED", assigneeId: editor.id, version: 3 } });
        await tx.actionTakenRevision.create({ data: { actionId: edited.id, editorId: editor.id, version: 3, assigneeId: editor.id,
          status: projection.status, actionDescription: projection.actionDescription, actionResult: projection.actionResult,
          followUpRequired: projection.followUpRequired, followUpNote: projection.followUpNote, attachmentNotes: projection.attachmentNotes } });
        await tx.ticket.update({ where: { id: edited.ticketId }, data: { ownerId: editor.id, currentStatus: "Reopened", workflowVersion: { increment: 1 } } });
      });
      await prisma.user.update({ where: { id: editor.id }, data: { name: "Human changed name", passwordHash: "human-changed-hash", mustChangePassword: false } });
      await prisma.category.update({ where: { id: tickets[0].categoryId }, data: { isActive: false } });
      const snapshot = async () => Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }), prisma.ticket.findMany({ orderBy: { id: "asc" } }),
        prisma.actionTaken.findMany({ orderBy: { id: "asc" } }), prisma.actionTakenRevision.findMany({ orderBy: { id: "asc" } }),
        prisma.category.findMany({ orderBy: { id: "asc" } }), prisma.relatedSystem.findMany({ orderBy: { id: "asc" } }),
        prisma.developmentRequester.findMany({ orderBy: { id: "asc" } }), prisma.ticketSequence.findMany({ orderBy: { year: "asc" } }),
        prisma.publicComment.findMany({ orderBy: { id: "asc" } }), prisma.internalNote.findMany({ orderBy: { id: "asc" } }),
      ]);
      const before = await snapshot();
      await seed(prisma);
      await seed(prisma);
      expect(await snapshot()).toEqual(before);
    });
  }, 30000);

  it.each(["lab4-empty@example.com", "alice@kmutt.ac.th", "staff1@example.com", "admin@example.com"])(
    "retains immutable identity and every row after editing %s", async email => {
      await withDatabaseFixture(async prisma => {
        for (const name of await migrationNames()) await applyMigration(prisma, name);
        // Exercise real legacy random IDs, not just new deterministic defaults.
        const legacyRequester = await prisma.developmentRequester.create({ data: { name: "Alice Developer", email: "alice@kmutt.ac.th" } });
        const legacyStaff = await prisma.user.create({ data: { id: randomUUID(), name: "Existing staff", email: "staff1@example.com", role: "IT_STAFF", passwordHash: "existing-staff-hash" } });
        const legacyAdmin = await prisma.user.create({ data: { id: randomUUID(), name: "Existing admin", email: "admin@example.com", role: "ADMINISTRATOR", passwordHash: "existing-admin-hash" } });
        await seed(prisma);
        expect((await prisma.seedUserIdentity.findUniqueOrThrow({ where: { seedKey: "requester-0" } })).userId).toBe(legacyRequester.id);
        expect((await prisma.seedUserIdentity.findUniqueOrThrow({ where: { seedKey: "staff-one" } })).userId).toBe(legacyStaff.id);
        expect((await prisma.seedUserIdentity.findUniqueOrThrow({ where: { seedKey: "administrator" } })).userId).toBe(legacyAdmin.id);
        const target = await prisma.user.findUniqueOrThrow({ where: { email } });
        await prisma.user.update({ where: { id: target.id }, data: {
          email: `edited-${target.id}@example.com`, name: "Manually edited identity",
          passwordHash: "manually-changed-credential", mustChangePassword: false,
          role: "REQUESTER", isActive: false,
        } });
        // Include the retained Lab 2 identity's email/name/activation as well.
        if (email === "alice@kmutt.ac.th") await prisma.developmentRequester.update({ where: { id: target.id }, data: {
          email: "edited-legacy-requester@example.com", name: "Edited legacy requester", isActive: false,
        } });
        const snapshot = async () => Promise.all([
          prisma.user.findMany({ orderBy: { id: "asc" } }), prisma.seedUserIdentity.findMany({ orderBy: { seedKey: "asc" } }),
          prisma.developmentRequester.findMany({ orderBy: { id: "asc" } }), prisma.ticket.findMany({ orderBy: { id: "asc" } }),
          prisma.actionTaken.findMany({ orderBy: { id: "asc" } }), prisma.actionTakenRevision.findMany({ orderBy: { id: "asc" } }),
          prisma.category.findMany({ orderBy: { id: "asc" } }), prisma.relatedSystem.findMany({ orderBy: { id: "asc" } }),
          prisma.ticketSequence.findMany({ orderBy: { year: "asc" } }), prisma.publicComment.findMany({ orderBy: { id: "asc" } }),
          prisma.internalNote.findMany({ orderBy: { id: "asc" } }),
        ]);
        const before = await snapshot();
        await seed(prisma);
        await seed(prisma);
        expect(await snapshot()).toEqual(before);
        expect(await prisma.user.count()).toBe(11);
        expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      });
    }, 30000,
  );

  it("refuses to recreate an unidentifiable renamed legacy staff account before mapping adoption", async () => {
    await withDatabaseFixture(async prisma => {
      for (const name of await migrationNames()) await applyMigration(prisma, name);
      const legacy = await prisma.user.create({ data: { name: "Renamed legacy account", email: "renamed-before-adoption@example.com", role: "REQUESTER", passwordHash: "existing-hash", isActive: false } });
      await expect(seed(prisma)).rejects.toThrow("Cannot safely identify legacy seed user");
      expect(await prisma.user.findMany()).toEqual([legacy]);
      expect(await prisma.seedUserIdentity.count()).toBe(0);
      expect(await prisma.developmentRequester.count()).toBe(0);
    });
  }, 30000);
});
