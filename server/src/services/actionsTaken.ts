import { Prisma, type ActionTaken, type ActionTakenRevision, type TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { ActionError, contentKeys, invalidAction, invalidAssignee, validateContent, type ActionChange, type ActionContent } from "./actionValidation.js";

const actionSelect = {
  id: true, ticketId: true, actionDescription: true, actionResult: true,
  followUpRequired: true, followUpNote: true, attachmentNotes: true, status: true,
  version: true, createdAt: true, updatedAt: true,
  performedBy: { select: { id: true, name: true, role: true } },
  assignee: { select: { id: true, name: true, role: true, isActive: true } },
} as const;
type ActionDTORecord = Prisma.ActionTakenGetPayload<{ select: typeof actionSelect }>;
const dto = (action: ActionDTORecord) => ({ ...action, actionDateTime: action.createdAt });
const active: TicketStatus[] = ["New", "Open", "InProgress", "WaitingForRequester", "Reopened"];
function missingTicket(): never { throw new ActionError(404, "TICKET_NOT_FOUND", "The requested ticket was not found."); }
function missingAction(): never { throw new ActionError(404, "ACTION_NOT_FOUND", "The requested action was not found."); }
const workflowConflict = (): never => { throw new ActionError(409, "TICKET_WORKFLOW_CONFLICT", "Ticket workflow does not permit this change. Reopen the ticket before operational changes."); };
const stateConflict = (): never => { throw new ActionError(409, "ACTION_STATE_CONFLICT", "This action transition or assignment is not permitted."); };
export const actionConflict = (): never => { throw new ActionError(409, "CONFLICT", "The record changed. Reload and review before trying again."); };
const snapshotKeys = [...contentKeys, "assigneeId", "status"] as const;
type Snapshot = ActionContent & Pick<ActionTaken, "assigneeId" | "status">;
const snapshot = (action: Snapshot): Snapshot => ({
  actionDescription: action.actionDescription, actionResult: action.actionResult,
  followUpRequired: action.followUpRequired, followUpNote: action.followUpNote,
  attachmentNotes: action.attachmentNotes, assigneeId: action.assigneeId, status: action.status,
});
const same = (a: Snapshot, b: Snapshot) => snapshotKeys.every(key => a[key] === b[key]);

async function lockTicket(tx: Prisma.TransactionClient, ticketId: string) {
  // Parameterized row locks share the exact parent row with future #60 status writes.
  await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
  const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) missingTicket();
  return ticket;
}

async function eligibleAssignee(tx: Prisma.TransactionClient, assigneeId: string) {
  // Blocks eligibility updates, but permits FK KEY SHARE checks on performers/editors.
  // FOR UPDATE would deadlock reciprocal assignments on unrelated Tickets.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${assigneeId} FOR NO KEY UPDATE`;
  const user = await tx.user.findUnique({ where: { id: assigneeId }, select: { role: true, isActive: true } });
  if (!user || !user.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(user.role)) invalidAssignee();
}

async function replay(tx: Prisma.TransactionClient, ticketId: string, performerId: string, clientRequestId: string, original: Snapshot) {
  const existing = await tx.actionTaken.findUnique({ where: { ticketId_performedById_clientRequestId: { ticketId, performedById: performerId, clientRequestId } }, select: { ...actionSelect, revisions: { where: { version: 1 } } } });
  if (!existing) return null;
  const first: ActionTakenRevision | undefined = existing.revisions[0];
  if (!first) throw new Error("Missing initial revision");
  if (!same(first, original)) throw new ActionError(409, "IDEMPOTENCY_CONFLICT", "This request ID was already used for different action content.");
  const { revisions: _revisions, ...current } = existing;
  const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { workflowVersion: true } });
  return { data: dto(current), meta: { workflowVersion: ticket.workflowVersion }, replay: true };
}

export async function createAction(ticketId: string, performerId: string, body: Record<string, unknown>) {
  const original: Snapshot = { ...validateContent(body), assigneeId: body.assigneeId as string ?? performerId, status: "PENDING" };
  const clientRequestId = body.clientRequestId as string;
  try {
    return await getPrisma().$transaction(async tx => {
      const ticket = await lockTicket(tx, ticketId);
      // Compare immutable intent before checking current parent/assignee business state.
      const previous = await replay(tx, ticketId, performerId, clientRequestId, original);
      if (previous) return previous;
      if (!active.includes(ticket.currentStatus)) workflowConflict();
      await eligibleAssignee(tx, original.assigneeId);
      const action = await tx.actionTaken.create({ data: {
        ticketId, performedById: performerId, clientRequestId, ...original,
        revisions: { create: { editorId: performerId, version: 1, ...original } },
      }, select: actionSelect });
      const parent = await tx.ticket.update({ where: { id: ticketId }, data: { workflowVersion: { increment: 1 } }, select: { workflowVersion: true } });
      return { data: dto(action), meta: parent, replay: false };
    });
  } catch (error) {
    // Defensive fallback for uniqueness races with other writers: failed transaction
    // is fully rolled back before a fresh consistent replay comparison.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const previous = await getPrisma().$transaction(tx => replay(tx, ticketId, performerId, clientRequestId, original), { isolationLevel: "RepeatableRead" });
      if (previous) return previous;
      actionConflict();
    }
    throw error;
  }
}

export async function patchAction(ticketId: string, actionId: string, editorId: string, body: Record<string, unknown>) {
  return getPrisma().$transaction(async tx => {
    const ticket = await lockTicket(tx, ticketId);
    await tx.$queryRaw`SELECT "id" FROM "ActionTaken" WHERE "id" = ${actionId} AND "ticketId" = ${ticketId} FOR UPDATE`;
    const current = await tx.actionTaken.findFirst({ where: { id: actionId, ticketId } });
    if (!current) missingAction();
    if (current.version !== body.expectedVersion) actionConflict();
    const change = body as ActionChange;
    const merged: Snapshot = { ...snapshot(current), ...validateContent({ ...snapshot(current), ...change }),
      assigneeId: change.assigneeId ?? current.assigneeId, status: change.status ?? current.status };
    if ("status" in body && (current.status !== "PENDING" || merged.status === "PENDING")) stateConflict();
    if ("assigneeId" in body) {
      if (current.status !== "PENDING") stateConflict();
      if (!active.includes(ticket.currentStatus)) workflowConflict();
    }
    if (current.status === "COMPLETED" && current.followUpRequired && !merged.followUpRequired &&
        (!("followUpNote" in body) || !merged.followUpNote || merged.followUpNote === current.followUpNote?.trim())) {
      invalidAction({ followUpNote: "Enter a new explanation of verification or correction before clearing completed follow-up." });
    }
    if ("status" in body && merged.status === "CANCELLED" && !("actionResult" in body)) invalidAction({ actionResult: "Enter an explicit cancellation reason." });
    if ("assigneeId" in body || ("status" in body && merged.status === "COMPLETED")) await eligibleAssignee(tx, merged.assigneeId);
    // A no-op is still version/state/eligibility checked, but performs no writes.
    if (same(current, merged)) {
      const action = await tx.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect });
      return { data: dto(action), meta: { workflowVersion: ticket.workflowVersion } };
    }
    if (ticket.currentStatus === "Resolved" || ticket.currentStatus === "Closed") {
      const otherWhere = { ticketId, id: { not: actionId } };
      const completed = await tx.actionTaken.count({ where: { ...otherWhere, status: "COMPLETED" } });
      const pending = await tx.actionTaken.count({ where: { ...otherWhere, status: "PENDING" } });
      const followUp = await tx.actionTaken.count({ where: { ...otherWhere, status: "COMPLETED", followUpRequired: true } });
      if (completed + Number(merged.status === "COMPLETED") < 1 ||
          pending + Number(merged.status === "PENDING") > 0 ||
          followUp + Number(merged.status === "COMPLETED" && merged.followUpRequired) > 0) workflowConflict();
    }
    const version = current.version + 1;
    const updated = await tx.actionTaken.updateMany({ where: { id: actionId, ticketId, version: current.version }, data: { ...merged, version } });
    if (updated.count !== 1) actionConflict();
    await tx.actionTakenRevision.create({ data: { actionId, editorId, version, ...merged } });
    const parent = await tx.ticket.update({ where: { id: ticketId }, data: { workflowVersion: { increment: 1 } }, select: { workflowVersion: true } });
    const action = await tx.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect });
    return { data: dto(action), meta: parent };
  });
}

export interface ActionPage { page: number; pageSize: number; focusActionId?: string }
export async function listActions(ticketId: string, pageQuery: ActionPage, requesterId?: string) {
  return getPrisma().$transaction(async tx => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, ...(requesterId ? { requesterId } : {}) }, select: { id: true } });
    if (!ticket) missingTicket();
    let { page } = pageQuery;
    const { pageSize, focusActionId } = pageQuery;
    if (focusActionId) {
      const target = await tx.actionTaken.findFirst({ where: { id: focusActionId, ticketId }, select: { id: true, createdAt: true } });
      if (!target) missingAction();
      const preceding = await tx.actionTaken.count({ where: { ticketId, OR: [{ createdAt: { lt: target.createdAt } }, { createdAt: target.createdAt, id: { lt: target.id } }] } });
      page = Math.floor(preceding / pageSize) + 1;
    }
    const totalItems = await tx.actionTaken.count({ where: { ticketId } });
    // Avoid database offset overflow for a valid far out-of-range page.
    const rows = (page - 1) * pageSize >= totalItems ? [] : await tx.actionTaken.findMany({ where: { ticketId }, select: actionSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize });
    return { data: rows.map(dto), meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } };
  }, { isolationLevel: "RepeatableRead" });
}
