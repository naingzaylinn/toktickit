import type { ActionStatus, PrismaClient, TicketStatus } from "@prisma/client";
import { generateTicketNumber } from "../src/services/ticketNumber.js";

// LOCAL DEVELOPMENT ONLY. Stable UUIDs identify intentions independently of
// content; existing tickets/actions/revisions are never repaired or overwritten.
export const LAB4_STATUSES: TicketStatus[] = ["New", "Open", "InProgress", "WaitingForRequester", "Resolved", "Closed", "Reopened", "Cancelled"];
const uuid = (kind: number, index: number) => `57000000-0000-4000-8000-${String(kind * 100 + index).padStart(12, "0")}`;

export async function seedLab4(prisma: PrismaClient, initialPasswordHash: string) {
  if (process.env.NODE_ENV === "production") throw new Error("Demonstration seeds are not permitted in production.");
  // A usable requester account with no tickets gives an actual empty dashboard,
  // in addition to the retained inactive Lab 2 requester.
  await prisma.user.upsert({ where: { id: uuid(7, 0) }, update: {}, create: {
    id: uuid(7, 0), email: "lab4-empty@example.com", name: "Lab 4 Empty Requester",
    role: "REQUESTER", passwordHash: initialPasswordHash, mustChangePassword: true,
  } });
  const identity = async (seedKey: string) => (await prisma.seedUserIdentity.findUniqueOrThrow({ where: { seedKey }, include: { user: true } })).user;
  const requester = await identity("requester-0");
  const owner = await identity("staff-one");
  const performer = await identity("staff-two");
  const assignee = await identity("administrator");
  const historical = await identity("staff-inactive");
  const category = await prisma.category.findUniqueOrThrow({ where: { name: "Network" } });
  const system = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Campus Wi-Fi" } });
  // Human changes to demo users must not be undone, nor used to assign new work
  // to an ineligible worker. Existing records remain untouched.
  const eligible = (user: typeof owner) => user.isActive && (user.role === "IT_STAFF" || user.role === "ADMINISTRATOR");
  if (![owner, performer, assignee].every(eligible) || requester.role !== "REQUESTER" || !requester.isActive) return;
  for (const [index, currentStatus] of LAB4_STATUSES.entries()) {
    await prisma.$transaction(async tx => {
      const clientRequestId = uuid(1, index);
      if (await tx.ticket.findUnique({ where: { requesterId_clientRequestId: { requesterId: requester.id, clientRequestId } } })) return;
      const actionCount = index === 0 || index === 7 ? 0 : index === 1 ? 1 : 2;
      const ticketDate = new Date(Date.UTC(2026, 9, 1 + index, 2));
      const ticket = await tx.ticket.create({ data: {
        id: uuid(2, index), clientRequestId, requesterId: requester.id,
        ticketNumber: await generateTicketNumber(tx, 2026), currentStatus,
        categoryId: category.id, relatedSystemId: system.id,
        summary: `Lab 4 ${currentStatus}: campus connection investigation`,
        description: "Demonstration of attributable work and retained action history.",
        requestedPriority: (["Low", "Medium", "High", "Urgent"] as const)[index % 4],
        itPriority: (["Low", "Medium", "High", "Urgent"] as const)[index % 4],
        ownerId: index < 2 ? null : owner.id,
        workflowVersion: actionCount * 2,
        ticketDate, createdAt: ticketDate,
        updatedAt: actionCount ? new Date(Date.UTC(2026, 9, 1 + index, 3, actionCount)) : ticketDate,
      } });
      for (let n = 0; n < actionCount; n++) {
        const serial = index * 2 + n;
        const terminalTicket = currentStatus === "Resolved" || currentStatus === "Closed";
        const status: ActionStatus = n === 1 ? "CANCELLED" : terminalTicket || index === 3 ? "COMPLETED" : "PENDING";
        const followUpRequired = n === 1 || index === 3;
        const historicAssignment = index === 6 && n === 0;
        const createdAt = new Date(Date.UTC(2026, 9, 1 + index, 3, n));
        const content = {
          actionDescription: n === 0 ? "Checked access point configuration and connection logs." : "Investigated a duplicate connection report.",
          actionResult: "Awaiting verification of the connection.",
          followUpRequired,
          followUpNote: followUpRequired ? "Ask the requester to retest during the next lecture." : null,
          attachmentNotes: n === 0 && index % 2 === 0 ? "Refer to the access point screenshot on the ticket." : null,
        };
        const finalContent = { ...content, actionResult: status === "COMPLETED" ? "Connection restored and verified." : status === "CANCELLED" ? "Cancelled duplicate investigation; retained for audit." : "Logs collected; awaiting requester verification." };
        await tx.actionTaken.create({ data: {
          id: uuid(3, serial), ticketId: ticket.id, performedById: performer.id,
          assigneeId: historicAssignment ? historical.id : assignee.id, status,
          clientRequestId: uuid(4, serial), version: 2, createdAt,
          updatedAt: new Date(createdAt.getTime() + 60000), ...finalContent,
          revisions: { create: [
            { id: uuid(5, serial), version: 1, editorId: performer.id, assigneeId: assignee.id,
              status: "PENDING", createdAt, ...content },
            { id: uuid(6, serial), version: 2, editorId: owner.id,
              assigneeId: historicAssignment ? historical.id : assignee.id, status,
              createdAt: new Date(createdAt.getTime() + 60000), ...finalContent },
          ] },
        } });
      }
    });
  }
}
