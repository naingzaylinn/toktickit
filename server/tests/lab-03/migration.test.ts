import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { applyMigration, migrationNames, withDatabaseFixture } from "./databaseFixture.js";
import { hashPassword, verifyPassword } from "../../src/services/passwords.js";

describe("Issue 2 non-destructive migration", () => {
  it("MIG-01/02/03/05: preserves Lab 2 IDs, ownership, attachments, events and reference data", async () => {
    await withDatabaseFixture(async prisma => {
      const migrations = await migrationNames();
      for (const name of migrations.filter(name => name < "20260918000000")) await applyMigration(prisma, name);
      const requester = await prisma.developmentRequester.create({ data: { name: "Existing Requester", email: "  Existing@Example.com  " } });
      const inactive = await prisma.developmentRequester.create({ data: { name: "Inactive Requester", email: "inactive@example.com", isActive: false } });
      const category = await prisma.category.create({ data: { name: "Existing Category", isActive: false } });
      const system = await prisma.relatedSystem.create({ data: { name: "Existing System", isActive: false } });
      // Populate the historical schema with SQL, independent of the current Prisma fields.
      const ticketId = randomUUID();
      await prisma.$executeRaw`INSERT INTO "Ticket" ("id", "ticketNumber", "requesterId", "categoryId", "relatedSystemId", "summary", "description", "clientRequestId", "requestedPriority", "updatedAt") VALUES (${ticketId}, 'TKT-2026-00041', ${requester.id}, ${category.id}, ${system.id}, 'Existing ticket', 'Preserve all fields', ${randomUUID()}, 'High', CURRENT_TIMESTAMP)`;
      const [ticket] = await prisma.$queryRaw<Array<{id:string;requesterId:string;[key:string]:unknown}>>`SELECT * FROM "Ticket" WHERE "id" = ${ticketId}`;
      const attachment = await prisma.attachment.create({ data: {
        ticketId: ticket.id, originalFilename: "existing.pdf", mimeType: "application/pdf", sizeBytes: 1024,
        storageKey: "existing-storage-key.pdf", isRemoved: true, removedAt: new Date(),
        removedByRequesterId: requester.id, removalReason: "Replaced evidence",
      } });
      const event = await prisma.ticketEvent.create({ data: {
        ticketId: ticket.id, attachmentId: attachment.id, actorRequesterId: requester.id, eventType: "ATTACHMENT_REMOVED",
        details: { reason: "Replaced evidence" },
      } });
      const sequence = await prisma.ticketSequence.create({ data: { year: 2026, lastValue: 41 } });
      await applyMigration(prisma, "20260918000000_add_user_auth");
      const placeholder = await prisma.user.findUniqueOrThrow({ where: { id: requester.id } });
      expect(await verifyPassword("Initial123", placeholder.passwordHash)).toBe(false);
      // A user who already changed their password must never be reset by repair.
      const changedHash = await hashPassword("AlreadyChanged123");
      await prisma.user.update({ where: { id: inactive.id }, data: { passwordHash: changedHash, mustChangePassword: false } });
      await applyMigration(prisma, "20260919000000_complete_authentication");
      await applyMigration(prisma, "20260920000000_requester_authorization");
      expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toEqual({...ticket, itPriority: "High", problemAppearsResolvedAt: null});
      expect(await prisma.attachment.findUnique({ where: { id: attachment.id } })).toEqual(attachment);
      expect(await prisma.ticketEvent.findUnique({ where: { id: event.id } })).toEqual(event);
      expect(await prisma.category.findUnique({ where: { id: category.id } })).toEqual(category);
      expect(await prisma.relatedSystem.findUnique({ where: { id: system.id } })).toEqual(system);
      expect(await prisma.ticketSequence.findUnique({ where: { year: 2026 } })).toEqual(sequence);
      expect(await prisma.developmentRequester.findUnique({ where: { id: requester.id } })).toEqual(requester);
      const migrated = await prisma.user.findUniqueOrThrow({ where: { id: requester.id } });
      expect(migrated).toMatchObject({ id: ticket.requesterId, email: "existing@example.com", role: "REQUESTER", isActive: true, mustChangePassword: true });
      expect(await verifyPassword("Initial123", migrated.passwordHash)).toBe(true);
      expect(await prisma.user.findUnique({ where: { id: inactive.id } })).toMatchObject({ isActive: false, mustChangePassword: false, passwordHash: changedHash });
      const relation = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { requester: true, attachments: true } });
      expect(relation.requester.id).toBe(migrated.id);
      expect(relation.attachments[0].storageKey).toBe(attachment.storageKey);
    });
  });
});
