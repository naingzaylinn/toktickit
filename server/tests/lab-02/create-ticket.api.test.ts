import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Feature-D: Create Ticket API", () => {
    const prisma = getPrisma();

    const ALICE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const BOB_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

    let categoryId: number;
    let relatedSystemId: string;

    beforeEach(async () => {
        vi.restoreAllMocks();

        await prisma.ticketEvent.deleteMany();
        await prisma.attachment.deleteMany();
        await prisma.ticket.deleteMany();
        await prisma.ticketSequence.deleteMany();

        const category = await prisma.category.upsert({
            where: {
                name: "Hardware",
            },
            update: {
                isActive: true,
            },
            create: {
                name: "Hardware",
                isActive: true,
            },
        });

        const system = await prisma.relatedSystem.upsert({
            where: {
                name: "VPN",
            },
            update: {
                isActive: true,
            },
            create: {
                name: "VPN",
                isActive: true,
            },
        });

        categoryId = category.id;
        relatedSystemId = system.id;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function validPayload(overrides: Record<string, unknown> = {}) {
        return {
            categoryId,
            relatedSystemId,
            requestedPriority: "Medium",
            summary: "Cannot connect to university VPN",
            description:
                "The VPN client fails every time I try to connect from home.",
            clientRequestId: randomUUID(),
            ...overrides,
        };
    }

    // API-015
    it("API-015: creates a valid ticket with generated values", async () => {
        const payload = validPayload();

        const res = await request(app)
            .post("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID)
            .send(payload);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("data");

        expect(res.body.data.id).toBeTruthy();
        expect(res.body.data.ticketNumber).toMatch(
            /^TKT-\d{4}-\d{5}$/
        );
        expect(res.body.data.currentStatus).toBe("New");
        expect(res.body.data.requestedPriority).toBe("Medium");
        expect(res.body.data.requesterId).toBe(ALICE_ID);
        expect(res.body.data.categoryId).toBe(categoryId);
        expect(res.body.data.relatedSystemId).toBe(
            relatedSystemId
        );

        const saved = await prisma.ticket.findUnique({
            where: {
                id: res.body.data.id,
            },
        });

        expect(saved).not.toBeNull();
        expect(saved?.requesterId).toBe(ALICE_ID);
        expect(saved?.currentStatus).toBe("New");
    });

    // API-016
    it("API-016: requester identity comes from header, not request body", async () => {
        const payload = validPayload({
            requesterId: BOB_ID,
        });

        const res = await request(app)
            .post("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID)
            .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.data.requesterId).toBe(ALICE_ID);

        const saved = await prisma.ticket.findUnique({
            where: {
                id: res.body.data.id,
            },
        });

        expect(saved?.requesterId).toBe(ALICE_ID);
    });

    // API-017
    it("API-017: exact replay returns existing ticket without duplicate creation", async () => {
        const clientRequestId = randomUUID();

        const payload = validPayload({
            clientRequestId,
        });

        const first = await request(app)
            .post("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID)
            .send(payload);

        expect(first.status).toBe(201);

        const second = await request(app)
            .post("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID)
            .send(payload);

        expect(second.status).toBe(200);
        expect(second.headers["idempotent-replay"]).toBe("true");

        expect(second.body.data.id).toBe(first.body.data.id);
        expect(second.body.data.ticketNumber).toBe(
            first.body.data.ticketNumber
        );

        const count = await prisma.ticket.count({
            where: {
                requesterId: ALICE_ID,
                clientRequestId,
            },
        });

        expect(count).toBe(1);
    });

    // API-018
    it("API-018: conflicting replay returns IDEMPOTENCY_CONFLICT", async () => {
        const clientRequestId = randomUUID();

        const firstPayload = validPayload({
            clientRequestId,
        });

        const first = await request(app)
            .post("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID)
            .send(firstPayload);

        expect(first.status).toBe(201);

        const conflictingPayload = {
            ...firstPayload,
            summary: "Different summary text",
        };

        const second = await request(app)
            .post("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID)
            .send(conflictingPayload);

        expect(second.status).toBe(409);
        expect(second.body.error.code).toBe(
            "IDEMPOTENCY_CONFLICT"
        );

        const count = await prisma.ticket.count({
            where: {
                requesterId: ALICE_ID,
                clientRequestId,
            },
        });

        expect(count).toBe(1);
    });

    // API-019
    it("API-019: concurrent ticket creation generates unique ticket numbers", async () => {
        const requests = Array.from({ length: 5 }, () =>
            request(app)
                .post("/api/v1/tickets")
                .set("X-Development-Requester-Id", ALICE_ID)
                .send(validPayload())
        );

        const responses = await Promise.all(requests);

        for (const res of responses) {
            expect(res.status).toBe(201);
            expect(res.body.data.ticketNumber).toMatch(
                /^TKT-\d{4}-\d{5}$/
            );
        }

        const ticketNumbers = responses.map(
            (res) => res.body.data.ticketNumber
        );

        expect(new Set(ticketNumbers).size).toBe(
            ticketNumbers.length
        );
    });

    // API-020
    it("API-020: rejects Summary shorter than 5 characters", async () => {
        const res = await request(app)
            .post("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID)
            .send(
                validPayload({
                    summary: "abc",
                })
            );

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");

        expect(res.body.error.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "summary",
                }),
            ])
        );
    });

    // API-021
    it("API-021: rejects Description shorter than 10 characters", async () => {
        const res = await request(app)
            .post("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID)
            .send(
                validPayload({
                    description: "short",
                })
            );

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");

        expect(res.body.error.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "description",
                }),
            ])
        );
    });

    // API-022
    it("API-022: trims Summary and Description before storing", async () => {
        const res = await request(app)
            .post("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID)
            .send(
                validPayload({
                    summary: "   VPN connection problem   ",
                    description:
                        "   The VPN connection fails every morning.   ",
                })
            );

        expect(res.status).toBe(201);

        expect(res.body.data.summary).toBe(
            "VPN connection problem"
        );
        expect(res.body.data.description).toBe(
            "The VPN connection fails every morning."
        );
    });

    it("rejects inactive Category", async () => {
        const software = await prisma.category.findUniqueOrThrow({
            where: {
                name: "Software",
            },
        });

        await prisma.category.update({
            where: {
                id: software.id,
            },
            data: {
                isActive: false,
            },
        });

        try {
            const res = await request(app)
                .post("/api/v1/tickets")
                .set("X-Development-Requester-Id", ALICE_ID)
                .send(
                    validPayload({
                        categoryId: software.id,
                    })
                );

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INACTIVE_CATEGORY");
        } finally {
            await prisma.category.update({
                where: {
                    id: software.id,
                },
                data: {
                    isActive: true,
                },
            });
        }
    });

    it("rejects inactive Related System", async () => {
        const inactiveSystem =
            await prisma.relatedSystem.create({
                data: {
                    name: `Inactive System ${randomUUID()}`,
                    isActive: false,
                },
            });

        try {
            const res = await request(app)
                .post("/api/v1/tickets")
                .set("X-Development-Requester-Id", ALICE_ID)
                .send(
                    validPayload({
                        relatedSystemId: inactiveSystem.id,
                    })
                );

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe(
                "INACTIVE_RELATED_SYSTEM"
            );
        } finally {
            await prisma.relatedSystem.delete({
                where: {
                    id: inactiveSystem.id,
                },
            });
        }
    });

    it("rejects missing requester header", async () => {
        const res = await request(app)
            .post("/api/v1/tickets")
            .send(validPayload());

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(
            "MISSING_REQUESTER_HEADER"
        );
    });
});