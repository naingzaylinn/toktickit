import { Prisma, type TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";

export const ticketTransitions: Record<TicketStatus, TicketStatus[]> = {
  New: ["Open", "InProgress", "Cancelled"],
  Open: ["InProgress", "WaitingForRequester", "Resolved", "Cancelled"],
  InProgress: ["WaitingForRequester", "Resolved", "Cancelled"],
  WaitingForRequester: ["InProgress", "Resolved", "Cancelled"],
  Resolved: ["Closed", "Reopened"], Closed: ["Reopened"],
  Reopened: ["InProgress", "WaitingForRequester", "Resolved", "Cancelled"],
  Cancelled: ["Reopened"],
};
export type ResolutionReason = "NO_COMPLETED_ACTIONS" | "PENDING_ACTIONS" | "FOLLOW_UP_REQUIRED";
export class WorkflowError extends Error {
  constructor(public status: number, public code: string, message: string, public reasonCodes?: ResolutionReason[]) { super(message); }
}

// Call within the detail snapshot or the parent-locked mutation transaction.
// Grouped counts keep the summary bounded without loading shared Action text.
export async function workflowSummary(tx: Prisma.TransactionClient, ticketId: string) {
  const groups = await tx.actionTaken.groupBy({ by: ["status", "followUpRequired"], where: { ticketId }, _count: { _all: true } });
  const summary = { totalItems: 0, pendingItems: 0, completedItems: 0, cancelledItems: 0, followUpRequiredItems: 0 };
  for (const group of groups) {
    const count = group._count._all;
    summary.totalItems += count;
    if (group.status === "PENDING") summary.pendingItems += count;
    if (group.status === "CANCELLED") summary.cancelledItems += count;
    if (group.status === "COMPLETED") {
      summary.completedItems += count;
      if (group.followUpRequired) summary.followUpRequiredItems += count;
    }
  }
  const reasonCodes: ResolutionReason[] = [];
  if (!summary.completedItems) reasonCodes.push("NO_COMPLETED_ACTIONS");
  if (summary.pendingItems) reasonCodes.push("PENDING_ACTIONS");
  if (summary.followUpRequiredItems) reasonCodes.push("FOLLOW_UP_REQUIRED");
  return { actionsTakenSummary: summary, resolutionEligibility: { eligible: reasonCodes.length === 0, reasonCodes } };
}

export async function transitionTicket(ticketId: string, next: TicketStatus, expectedWorkflowVersion: number) {
  return getPrisma().$transaction(async tx => {
    // Same parent row and lock ordering as Actions Taken. No child locks needed.
    await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId }, select: { currentStatus: true, workflowVersion: true } });
    if (!ticket) throw new WorkflowError(404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
    if (ticket.workflowVersion !== expectedWorkflowVersion) throw new WorkflowError(409, "CONFLICT", "Ticket state changed. Reload and review before choosing a transition again.");
    if (!ticketTransitions[ticket.currentStatus].includes(next)) throw new WorkflowError(409, "CONFLICT", "This status transition is not permitted.");
    if (next === "Resolved" || next === "Closed") {
      const { actionsTakenSummary, resolutionEligibility } = await workflowSummary(tx, ticketId);
      if (!resolutionEligibility.eligible && (next === "Resolved" || actionsTakenSummary.totalItems > 0)) {
        throw new WorkflowError(409, "RESOLUTION_REQUIREMENTS_NOT_MET", "Review Actions Taken before resolving or closing this Ticket.", resolutionEligibility.reasonCodes);
      }
    }
    const result = await tx.ticket.updateMany({ where: { id: ticketId, workflowVersion: expectedWorkflowVersion }, data: { currentStatus: next, workflowVersion: { increment: 1 } } });
    if (result.count !== 1) throw new WorkflowError(409, "CONFLICT", "Ticket state changed. Reload and review before choosing a transition again.");
    return { workflowVersion: expectedWorkflowVersion + 1 };
  });
}
