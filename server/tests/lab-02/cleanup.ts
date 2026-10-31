import type { PrismaClient } from "@prisma/client";

/** Remove ticket fixtures in dependent-first order while retaining FK checks. */
export async function cleanupTickets(prisma: PrismaClient) {
    await prisma.actionTakenRevision.deleteMany();
    await prisma.actionTaken.deleteMany();
    await prisma.publicComment.deleteMany();
    await prisma.internalNote.deleteMany();
    await prisma.ticketEvent.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.ticketSequence.deleteMany();
}
