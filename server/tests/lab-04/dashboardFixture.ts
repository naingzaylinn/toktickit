import { PrismaClient, type TicketStatus, type RequestedPriority } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { vi } from "vitest";
import * as database from "../../src/prisma.js";
import { applyMigration, migrationNames } from "../lab-03/databaseFixture.js";
import { sessionTokenHash, SESSION_COOKIE } from "../../src/services/sessions.js";

export async function dashboardFixture() {
  const source = process.env.DATABASE_URL;
  if (!source || !/^issue2_test_[a-f0-9]{32}$/.test(new URL(source).searchParams.get("schema") ?? "")) throw new Error("Use test:isolated for dashboards.");
  const schema = "dashboard_fixture_" + randomUUID().replaceAll("-", "");
  const admin = database.getPrisma();
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const url = new URL(source); url.searchParams.set("schema", schema);
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let spy: ReturnType<typeof vi.spyOn> | undefined;
  try {
    for (const name of await migrationNames()) await applyMigration(prisma, name);
    const users = await Promise.all(["REQUESTER", "IT_STAFF", "ADMINISTRATOR", "IT_STAFF"].map((role, i) => prisma.user.create({ data: {
      name: "Dashboard " + i, email: randomUUID() + "@dashboard.test", passwordHash: "fixture", mustChangePassword: false,
      role: role as "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", isActive: i !== 3,
    } })));
    const cookies: string[] = [];
    for (const user of users) { const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
      await prisma.session.create({ data: { token: sessionTokenHash(token), userId: user.id, expiresAt: new Date(Date.now() + 3600000) } }); cookies.push(SESSION_COOKIE + "=" + token); }
    const category = await prisma.category.create({ data: { name: "Dashboard" } });
    const system = await prisma.relatedSystem.create({ data: { name: "Dashboard" } });
    spy = vi.spyOn(database, "getPrisma").mockReturnValue(prisma);
    let sequence = 0;
    const ticket = (status: TicketStatus = "Open", ownerId: string | null = null, priority: RequestedPriority = "Medium", updatedAt = new Date("2020-01-01T00:00:00Z")) => prisma.ticket.create({ data: {
      ticketNumber: "DASH-" + String(++sequence).padStart(5, "0"), clientRequestId: randomUUID(), requesterId: users[0].id,
      categoryId: category.id, relatedSystemId: system.id, summary: "Dashboard Ticket " + sequence, description: "Sensitive description",
      currentStatus: status, ownerId, itPriority: priority, requestedPriority: priority === "Urgent" ? "Low" : "Urgent", updatedAt,
    } });
    const action = (ticketId: string, performedById = users[1].id, assigneeId = users[2].id, status: "PENDING" | "COMPLETED" | "CANCELLED" = "PENDING", createdAt = new Date("2020-01-01T00:00:00Z")) => prisma.actionTaken.create({ data: {
      ticketId, performedById, assigneeId, status, createdAt, actionDescription: "Dashboard Action", actionResult: "Evidence", followUpRequired: true,
      followUpNote: "Historical follow-up", clientRequestId: randomUUID(), revisions: { create: { editorId: performedById, assigneeId, status, version: 1,
        actionDescription: "Dashboard Action", actionResult: "Evidence", followUpRequired: true, followUpNote: "Historical follow-up" } },
    } });
    return { prisma, users, cookies, ticket, action, close: async () => { spy?.mockRestore(); await prisma.$disconnect(); await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); } };
  } catch (error) { spy?.mockRestore(); await prisma.$disconnect(); await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); throw error; }
}
export type DashboardFixture = Awaited<ReturnType<typeof dashboardFixture>>;
