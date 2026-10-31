import type { AuthUser, RequesterDashboardResponse } from "../../src/api.js";
export const dashboardUser: AuthUser = { id: "requester-1", name: "Requester One", email: "r@test", role: "REQUESTER", isActive: true, mustChangePassword: false };
export function dashboardResponse(): RequesterDashboardResponse {
  return { data: { totalTickets: 42, activeTickets: 30, waitingForRequesterTickets: 6, resolvedTickets: 4,
    byStatus: { NEW: 5, OPEN: 8, IN_PROGRESS: 9, WAITING_FOR_REQUESTER: 6, RESOLVED: 4, CLOSED: 4, REOPENED: 2, CANCELLED: 4 },
    recentTickets: [{ id: "ticket-1", ticketNumber: "TKT-1", summary: "Network repair", status: "CLOSED", updatedAt: "2026-10-13T01:00:00.000Z" }],
    resolvedTicketsRecent: [{ id: "ticket-2", ticketNumber: "TKT-2", summary: "Resolved repair", status: "RESOLVED", updatedAt: "2026-10-13T01:00:00.000Z" }]
  }, meta: { generatedAt: "2026-10-13T02:00:00.000Z" } };
}
