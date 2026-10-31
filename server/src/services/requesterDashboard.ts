import { getPrisma } from "../prisma.js";
import { activeTicketStatuses, statusToApi } from "./ticketDashboardDefinitions.js";

export async function requesterDashboard(requesterId: string) {
  const data = await getPrisma().$transaction(async tx => {
    const where = { requesterId };
    const groups = await tx.ticket.groupBy({ by: ["currentStatus"], where, _count: { _all: true } });
    const byStatus = Object.fromEntries(Object.values(statusToApi).map(status => [status, 0]));
    let totalTickets = 0, activeTickets = 0;
    for (const group of groups) {
      const count = group._count._all;
      byStatus[statusToApi[group.currentStatus]] = count;
      totalTickets += count;
      if (activeTicketStatuses.includes(group.currentStatus)) activeTickets += count;
    }
    const select = { id: true, ticketNumber: true, summary: true, currentStatus: true, updatedAt: true } as const;
    const orderBy = [{ updatedAt: "desc" }, { ticketNumber: "asc" }] as const;
    const recent = await tx.ticket.findMany({ where, select, orderBy: [...orderBy], take: 5 });
    const resolved = await tx.ticket.findMany({ where: { ...where, currentStatus: "Resolved" }, select, orderBy: [...orderBy], take: 5 });
    const rows = (tickets: typeof recent) => tickets.map(({ currentStatus, ...ticket }) => ({ ...ticket, status: statusToApi[currentStatus] }));
    return { totalTickets, activeTickets, waitingForRequesterTickets: byStatus.WAITING_FOR_REQUESTER,
      resolvedTickets: byStatus.RESOLVED, byStatus, recentTickets: rows(recent), resolvedTicketsRecent: rows(resolved) };
  }, { isolationLevel: "RepeatableRead" });
  return { data, meta: { generatedAt: new Date().toISOString() } };
}
