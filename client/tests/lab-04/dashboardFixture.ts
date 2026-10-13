import type { AuthUser, StaffDashboardResponse } from "../../src/api.js";
export const dashboardUser: AuthUser = { id: "staff-1", name: "Staff One", email: "staff@test", role: "IT_STAFF", isActive: true, mustChangePassword: false };
export function dashboardResponse(): StaffDashboardResponse {
  return { data: { totalTickets: 42, activeTickets: 30, unassignedActiveTickets: 11, myActiveTickets: 7,
    byStatus: { NEW: 5, OPEN: 8, IN_PROGRESS: 9, WAITING_FOR_REQUESTER: 6, RESOLVED: 4, CLOSED: 4, REOPENED: 2, CANCELLED: 4 },
    activeByItPriority: { LOW: 3, MEDIUM: 14, HIGH: 9, URGENT: 4 },
    recentTickets: [{ id: "ticket-1", ticketNumber: "TKT-1", summary: "Network repair", status: "CLOSED", itPriority: "URGENT", owner: null, updatedAt: "2026-10-13T01:00:00.000Z" }],
    myActions: { totalItems: 19, items: [{ id: "action-1", ticketId: "ticket-1", ticketNumber: "TKT-1", actionDateTime: "2026-10-12T01:00:00.000Z", actionDescription: "Original work", followUpRequired: true, status: "CANCELLED", assignee: { id: "other", name: "Other Worker", role: "IT_STAFF", isActive: false } }] },
  }, meta: { generatedAt: "2026-10-13T02:00:00.000Z" } };
}
