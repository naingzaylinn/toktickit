import { Prisma } from "@prisma/client";

export async function generateTicketNumber(
    tx: Prisma.TransactionClient,
    year: number
): Promise<string> {
    const sequence = await tx.ticketSequence.upsert({
        where: { year },
        update: {
            lastValue: {
                increment: 1,
            },
        },
        create: {
            year,
            lastValue: 1,
        },
    });

    const padded = String(sequence.lastValue).padStart(5, "0");

    return `TKT-${year}-${padded}`;
}