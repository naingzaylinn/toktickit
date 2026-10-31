import type { RequestedPriority, TicketStatus } from "@prisma/client";

export const activeTicketStatuses: TicketStatus[] = ["New", "Open", "InProgress", "WaitingForRequester", "Reopened"];
export const statusToApi: Record<TicketStatus, string> = {
  New: "NEW", Open: "OPEN", InProgress: "IN_PROGRESS", WaitingForRequester: "WAITING_FOR_REQUESTER",
  Resolved: "RESOLVED", Closed: "CLOSED", Reopened: "REOPENED", Cancelled: "CANCELLED",
};
export const priorityToApi: Record<RequestedPriority, string> = { Low: "LOW", Medium: "MEDIUM", High: "HIGH", Urgent: "URGENT" };
