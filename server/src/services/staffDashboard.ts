import { getPrisma } from "../prisma.js";
import { activeTicketStatuses, priorityToApi, statusToApi } from "./ticketDashboardDefinitions.js";

export async function staffDashboard(userId: string) {
  const data = await getPrisma().$transaction(async tx => {
    const active = { currentStatus: { in: activeTicketStatuses } };
    const statuses = await tx.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } });
    const byStatus = Object.fromEntries(Object.values(statusToApi).map(key => [key, 0]));
    let totalTickets = 0, activeTickets = 0;
    for (const group of statuses) {
      byStatus[statusToApi[group.currentStatus]] = group._count._all;
      totalTickets += group._count._all;
      if (activeTicketStatuses.includes(group.currentStatus)) activeTickets += group._count._all;
    }
    const unassignedActiveTickets = await tx.ticket.count({ where: { ...active, ownerId: null } });
    const myActiveTickets = await tx.ticket.count({ where: { ...active, ownerId: userId } });
    const priorities = await tx.ticket.groupBy({ by: ["itPriority"], where: active, _count: { _all: true } });
    const activeByItPriority = Object.fromEntries(Object.values(priorityToApi).map(key => [key, 0]));
    for (const group of priorities) activeByItPriority[priorityToApi[group.itPriority]] = group._count._all;
    const recent = await tx.ticket.findMany({ take: 5, orderBy: [{ updatedAt: "desc" }, { ticketNumber: "asc" }], select: {
      id: true, ticketNumber: true, summary: true, currentStatus: true, itPriority: true, updatedAt: true,
      owner: { select: { id: true, name: true } },
    } });
    const where = { performedById: userId };
    const totalItems = await tx.actionTaken.count({ where });
    const actions = await tx.actionTaken.findMany({ where, take: 5, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
      id: true, ticketId: true, createdAt: true, actionDescription: true, followUpRequired: true, status: true,
      ticket: { select: { ticketNumber: true } }, assignee: { select: { id: true, name: true, role: true, isActive: true } },
    } });
    return { totalTickets, activeTickets, unassignedActiveTickets, myActiveTickets, byStatus, activeByItPriority,
      recentTickets: recent.map(({ currentStatus, itPriority, ...row }) => ({ ...row, status: statusToApi[currentStatus], itPriority: priorityToApi[itPriority] })),
      myActions: { totalItems, items: actions.map(({ createdAt, ticket, ...row }) => ({ ...row, ticketNumber: ticket.ticketNumber, actionDateTime: createdAt })) },
    };
  }, { isolationLevel: "RepeatableRead" });
  return { data, meta: { generatedAt: new Date().toISOString() } };
}
