import { describe, expect, it } from "vitest";
import { seed, DEVELOPMENT_REQUESTERS, LOCAL_INITIAL_PASSWORD } from "../../prisma/seed.js";
import { applyMigration, migrationNames, withDatabaseFixture } from "./databaseFixture.js";
import { hashPassword, verifyPassword } from "../../src/services/passwords.js";

describe("Issue 2 local development seed", () => {
  it("SEED-01 through SEED-06: is idempotent, preserves changed passwords and provides the required role distribution", async () => {
    await withDatabaseFixture(async prisma => {
      for (const name of await migrationNames()) await applyMigration(prisma, name);
      // Exercise installations whose original requester UUID differs from seed.ts.
      const existing = await prisma.developmentRequester.create({ data: { name: "Alice Developer", email: DEVELOPMENT_REQUESTERS[0].email } });
      await seed(prisma);
      const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
      expect(users.filter(user => user.role === "REQUESTER" && user.isActive)).toHaveLength(4);
      expect(users.filter(user => user.role === "REQUESTER" && !user.isActive)).toHaveLength(1);
      expect(users.filter(user => user.role === "IT_STAFF" && user.isActive)).toHaveLength(3);
      expect(users.filter(user => user.role === "IT_STAFF" && !user.isActive)).toHaveLength(1);
      expect(users.filter(user => user.role === "ADMINISTRATOR" && user.isActive)).toHaveLength(1);
      for (const user of users) {
        expect(user.mustChangePassword).toBe(true);
        expect(user.passwordHash).not.toBe(LOCAL_INITIAL_PASSWORD);
        expect(await verifyPassword(LOCAL_INITIAL_PASSWORD, user.passwordHash)).toBe(true);
      }
      const tickets = await prisma.ticket.findMany({ orderBy: { id: "asc" } });
      expect(tickets).toHaveLength(4);
      expect(new Set(tickets.map(ticket => ticket.requesterId)).size).toBe(4);
      expect(new Set(tickets.map(ticket => ticket.requestedPriority)).size).toBe(4);
      expect(tickets.some(ticket => ticket.requesterId === existing.id)).toBe(true);
      const changedHash = await hashPassword("Changed123");
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: changedHash, mustChangePassword: false } });
      const before = await prisma.user.findMany({ orderBy: { id: "asc" } });
      await seed(prisma);
      expect(await prisma.user.findMany({ orderBy: { id: "asc" } })).toEqual(before);
      expect(await prisma.ticket.findMany({ orderBy: { id: "asc" } })).toEqual(tickets);
      expect(await prisma.category.count()).toBe(4);
      expect(await prisma.relatedSystem.count()).toBe(7);
    });
  }, 15000);
});
