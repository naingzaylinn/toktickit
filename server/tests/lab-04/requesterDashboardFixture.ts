import { randomUUID } from "node:crypto";
import type { TicketStatus } from "@prisma/client";
import { dashboardFixture } from "./dashboardFixture.js";
import { sessionTokenHash, SESSION_COOKIE } from "../../src/services/sessions.js";
export const requesterStatuses = ["New", "Open", "InProgress", "WaitingForRequester", "Resolved", "Closed", "Reopened", "Cancelled"] as const;
export const requesterKeys = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
export async function requesterDashboardFixture() {
  const f = await dashboardFixture();
  try {
    const other = await f.prisma.user.create({ data: { name: "Other Requester", email: randomUUID() + "@test.local", role: "REQUESTER", passwordHash: "fixture", mustChangePassword: false } });
    const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
    await f.prisma.session.create({ data: { userId: other.id, token: sessionTokenHash(token), expiresAt: new Date(Date.now() + 3600000) } });
    const ownedTicket = async (requesterId = f.users[0].id, status: TicketStatus = "Open", updatedAt = new Date("2020-01-01"), ownerId: string | null = null) => {
      const ticket = await f.ticket(status, ownerId, "Medium", updatedAt);
      return f.prisma.ticket.update({ where: { id: ticket.id }, data: { requesterId, updatedAt } });
    };
    return { ...f, other, otherCookie: SESSION_COOKIE + "=" + token, ownedTicket };
  } catch (error) { await f.close(); throw error; }
}
export type RequesterFixture = Awaited<ReturnType<typeof requesterDashboardFixture>>;
