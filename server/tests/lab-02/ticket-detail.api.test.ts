import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Feature-F: Requester Ticket Detail API", () => {
    const prisma = getPrisma();

    const ALICE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const BOB_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

    let categoryId: number;
    let relatedSystemId: string;

    beforeEach(async () => {
        await prisma.ticketEvent.deleteMany();
        await prisma.attachment.deleteMany();
        await prisma.ticket.deleteMany();
        await prisma.ticketSequence.deleteMany();

        const category = await prisma.category.findUniqueOrThrow({
            where: {
                name: "Hardware",
            },
        });

        const relatedSystem =
            await prisma.relatedSystem.findUniqueOrThrow({
                where: {
                    name: "VPN",
                },
            });

        categoryId = category.id;
        relatedSystemId = relatedSystem.id;

        await prisma.category.update({
            where: {
                id: categoryId,
            },
            data: {
                isActive: true,
            },
        });

        await prisma.relatedSystem.update({
            where: {
                id: relatedSystemId,
            },
            data: {
                isActive: true,
            },
        });
    });

    afterEach(async () => {
        if (categoryId) {
            await prisma.category.update({
                where: {
                    id: categoryId,
                },
                data: {
                    isActive: true,
                },
            });
        }

        if (relatedSystemId) {
            await prisma.relatedSystem.update({
                where: {
                    id: relatedSystemId,
                },
                data: {
                    isActive: true,
                },
            });
        }
    });

    async function createTicket(
        requesterId: string,
        overrides?: {
            categoryId?: number;
            relatedSystemId?: string;
        }
    ) {
        return prisma.ticket.create({
            data: {
                ticketNumber: `TKT-2026-${Math.floor(
                    Math.random() * 90000 + 10000
                )}`,
                ticketDate: new Date("2026-09-05T13:00:00.000Z"),
                currentStatus: "New",
                requestedPriority: "Medium",
                summary: "Cannot connect to campus VPN",
                description:
                    "The VPN connection fails after authentication from home.",
                clientRequestId: randomUUID(),
                requesterId,
                categoryId:
                    overrides?.categoryId ?? categoryId,
                relatedSystemId:
                    overrides?.relatedSystemId ?? relatedSystemId,
                createdAt: new Date("2026-09-05T13:00:00.000Z"),
                updatedAt: new Date("2026-09-05T13:05:00.000Z"),
            },
        });
    }

    // API-038
    it("API-038: returns full detail for a ticket owned by the requester", async () => {
        const ticket = await createTicket(ALICE_ID);

        const res = await request(app)
            .get(`/api/v1/tickets/${ticket.id}`)
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(200);

        expect(res.body.data).toMatchObject({
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            currentStatus: "New",
            requestedPriority: "Medium",
            summary: "Cannot connect to campus VPN",
            description:
                "The VPN connection fails after authentication from home.",
            requester: {
                id: ALICE_ID,
                name: "Alice Developer",
                email: "alice@kmutt.ac.th",
            },
            category: {
                id: categoryId,
                name: "Hardware",
                isActive: true,
            },
            relatedSystem: {
                id: relatedSystemId,
                name: "VPN",
                isActive: true,
            },
            activeAttachments: [],
            removedAttachments: [],
        });

        expect(res.body.data).toHaveProperty(
            "ticketDate"
        );

        expect(res.body.data).toHaveProperty(
            "createdAt"
        );

        expect(res.body.data).toHaveProperty(
            "updatedAt"
        );
    });

    // API-039
    it("API-039: returns neutral 404 for nonexistent ticket", async () => {
        const nonexistentId = randomUUID();

        const res = await request(app)
            .get(`/api/v1/tickets/${nonexistentId}`)
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe(
            "TICKET_NOT_FOUND"
        );

        expect(res.body.error.message).toBe(
            "The requested ticket was not found."
        );

        expect(res.body.error).toHaveProperty(
            "correlationId"
        );
    });

    // API-040
    it("API-040: returns the same neutral 404 for another requester's ticket", async () => {
        const bobTicket = await createTicket(BOB_ID);

        const res = await request(app)
            .get(`/api/v1/tickets/${bobTicket.id}`)
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe(
            "TICKET_NOT_FOUND"
        );

        expect(res.body.error.message).toBe(
            "The requested ticket was not found."
        );

        expect(res.body.error).toHaveProperty(
            "correlationId"
        );
    });

    // API-041
    it("API-041: rejects malformed ticket ID", async () => {
        const res = await request(app)
            .get(
                "/api/v1/tickets/not-a-valid-ticket-id"
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(
            "INVALID_TICKET_ID"
        );

        expect(res.body.error).toHaveProperty(
            "correlationId"
        );
    });

    it("returns historical inactive Category and Related System metadata", async () => {
        await prisma.category.update({
            where: {
                id: categoryId,
            },
            data: {
                isActive: false,
            },
        });

        await prisma.relatedSystem.update({
            where: {
                id: relatedSystemId,
            },
            data: {
                isActive: false,
            },
        });

        const ticket = await createTicket(ALICE_ID);

        const res = await request(app)
            .get(`/api/v1/tickets/${ticket.id}`)
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(200);

        expect(res.body.data.category).toEqual({
            id: categoryId,
            name: "Hardware",
            isActive: false,
        });

        expect(res.body.data.relatedSystem).toEqual({
            id: relatedSystemId,
            name: "VPN",
            isActive: false,
        });
    });
});