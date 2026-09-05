import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Feature-E: My Tickets API", () => {
    const prisma = getPrisma();

    const ALICE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const BOB_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

    let hardwareId: number;
    let softwareId: number;
    let vpnId: string;
    let emailId: string;

    beforeEach(async () => {
        vi.restoreAllMocks();

        await prisma.ticket.deleteMany();
        await prisma.ticketSequence.deleteMany();

        const hardware = await prisma.category.findUniqueOrThrow({
            where: { name: "Hardware" },
        });

        const software = await prisma.category.findUniqueOrThrow({
            where: { name: "Software" },
        });

        const vpn = await prisma.relatedSystem.findUniqueOrThrow({
            where: { name: "VPN" },
        });

        const email = await prisma.relatedSystem.findUniqueOrThrow({
            where: { name: "Email" },
        });

        hardwareId = hardware.id;
        softwareId = software.id;
        vpnId = vpn.id;
        emailId = email.id;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function createTicket(options: {
        requesterId?: string;
        ticketNumber: string;
        summary: string;
        description?: string;
        categoryId?: number;
        relatedSystemId?: string;
        requestedPriority?: "Low" | "Medium" | "High" | "Urgent";
        createdAt?: Date;
        updatedAt?: Date;
    }) {
        const createdAt = options.createdAt ?? new Date();
        const updatedAt = options.updatedAt ?? createdAt;

        return prisma.ticket.create({
            data: {
                ticketNumber: options.ticketNumber,
                ticketDate: createdAt,
                currentStatus: "New",
                requestedPriority: options.requestedPriority ?? "Medium",
                summary: options.summary,
                description:
                    options.description ??
                    "Valid ticket description for My Tickets testing.",
                clientRequestId: randomUUID(),
                requesterId: options.requesterId ?? ALICE_ID,
                categoryId: options.categoryId ?? hardwareId,
                relatedSystemId: options.relatedSystemId ?? vpnId,
                createdAt,
                updatedAt,
            },
        });
    }

    // API-024
    it("API-024: returns only tickets owned by the requester", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "Alice hardware issue",
            requesterId: ALICE_ID,
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "Bob hardware issue",
            requesterId: BOB_ID,
        });

        const res = await request(app)
            .get("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].summary).toBe("Alice hardware issue");

        expect(
            res.body.data.some(
                (ticket: { summary: string }) =>
                    ticket.summary === "Bob hardware issue"
            )
        ).toBe(false);
    });

    // API-025
    it("API-025: searches by Ticket Number case-insensitively", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "VPN issue",
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "Email issue",
        });

        const res = await request(app)
            .get("/api/v1/tickets?q=tkt-2026-00001")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].ticketNumber).toBe("TKT-2026-00001");
    });

    // API-026
    it("API-026: searches Summary and Description case-insensitively", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "Campus VPN unavailable",
            description: "GlobalProtect fails from home.",
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "Printer issue",
            description: "Printer queue is unavailable.",
        });

        const bySummary = await request(app)
            .get("/api/v1/tickets?q=vpn")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(bySummary.status).toBe(200);
        expect(bySummary.body.data).toHaveLength(1);
        expect(bySummary.body.data[0].ticketNumber).toBe("TKT-2026-00001");

        const byDescription = await request(app)
            .get("/api/v1/tickets?q=globalprotect")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(byDescription.status).toBe(200);
        expect(byDescription.body.data).toHaveLength(1);
        expect(byDescription.body.data[0].ticketNumber).toBe(
            "TKT-2026-00001"
        );
    });

    // API-027
    it("API-027: filters by Category ID", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "Hardware ticket",
            categoryId: hardwareId,
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "Software ticket",
            categoryId: softwareId,
        });

        const res = await request(app)
            .get(`/api/v1/tickets?categoryId=${hardwareId}`)
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].category.id).toBe(hardwareId);
    });

    // API-028
    it("API-028: filters by Related System ID", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "VPN ticket",
            relatedSystemId: vpnId,
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "Email ticket",
            relatedSystemId: emailId,
        });

        const res = await request(app)
            .get(`/api/v1/tickets?relatedSystemId=${vpnId}`)
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].relatedSystem.id).toBe(vpnId);
    });

    // API-029
    it("API-029: filters by Requested Priority", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "High priority ticket",
            requestedPriority: "High",
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "Low priority ticket",
            requestedPriority: "Low",
        });

        const res = await request(app)
            .get("/api/v1/tickets?requestedPriority=High")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].requestedPriority).toBe("High");
    });

    // API-030
    it("API-030: filters by Current Status", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "New ticket",
        });

        const res = await request(app)
            .get("/api/v1/tickets?currentStatus=New")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].currentStatus).toBe("New");
    });

    // API-031
    it("API-031: combines filters using logical AND", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "Hardware High",
            categoryId: hardwareId,
            requestedPriority: "High",
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "Hardware Low",
            categoryId: hardwareId,
            requestedPriority: "Low",
        });

        await createTicket({
            ticketNumber: "TKT-2026-00003",
            summary: "Software High",
            categoryId: softwareId,
            requestedPriority: "High",
        });

        const res = await request(app)
            .get(
                `/api/v1/tickets?categoryId=${hardwareId}&requestedPriority=High`
            )
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].summary).toBe("Hardware High");
    });

    // API-032
    it("API-032: combines search and filters using logical AND", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "VPN hardware problem",
            categoryId: hardwareId,
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "VPN software problem",
            categoryId: softwareId,
        });

        const res = await request(app)
            .get(`/api/v1/tickets?q=vpn&categoryId=${hardwareId}`)
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].summary).toBe("VPN hardware problem");
    });

    // API-033
    it("API-033: defaults to newest sorting with deterministic ticket number tie-break", async () => {
        const older = new Date("2026-09-01T10:00:00.000Z");
        const newer = new Date("2026-09-02T10:00:00.000Z");

        await createTicket({
            ticketNumber: "TKT-2026-00003",
            summary: "Older",
            createdAt: older,
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "Newer B",
            createdAt: newer,
        });

        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "Newer A",
            createdAt: newer,
        });

        const res = await request(app)
            .get("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);

        expect(
            res.body.data.map(
                (ticket: { ticketNumber: string }) => ticket.ticketNumber
            )
        ).toEqual([
            "TKT-2026-00001",
            "TKT-2026-00002",
            "TKT-2026-00003",
        ]);
    });

    // API-034
    it("API-034: supports oldest, recentlyUpdated, and ticketNumberAsc sorting", async () => {
        await createTicket({
            ticketNumber: "TKT-2026-00003",
            summary: "Third",
            createdAt: new Date("2026-09-03T10:00:00.000Z"),
            updatedAt: new Date("2026-09-03T12:00:00.000Z"),
        });

        await createTicket({
            ticketNumber: "TKT-2026-00001",
            summary: "First",
            createdAt: new Date("2026-09-01T10:00:00.000Z"),
            updatedAt: new Date("2026-09-04T12:00:00.000Z"),
        });

        await createTicket({
            ticketNumber: "TKT-2026-00002",
            summary: "Second",
            createdAt: new Date("2026-09-02T10:00:00.000Z"),
            updatedAt: new Date("2026-09-02T12:00:00.000Z"),
        });

        const oldest = await request(app)
            .get("/api/v1/tickets?sortBy=oldest")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(
            oldest.body.data.map(
                (ticket: { ticketNumber: string }) => ticket.ticketNumber
            )
        ).toEqual([
            "TKT-2026-00001",
            "TKT-2026-00002",
            "TKT-2026-00003",
        ]);

        const recentlyUpdated = await request(app)
            .get("/api/v1/tickets?sortBy=recentlyUpdated")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(
            recentlyUpdated.body.data.map(
                (ticket: { ticketNumber: string }) => ticket.ticketNumber
            )
        ).toEqual([
            "TKT-2026-00001",
            "TKT-2026-00003",
            "TKT-2026-00002",
        ]);

        const ticketNumberAsc = await request(app)
            .get("/api/v1/tickets?sortBy=ticketNumberAsc")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(
            ticketNumberAsc.body.data.map(
                (ticket: { ticketNumber: string }) => ticket.ticketNumber
            )
        ).toEqual([
            "TKT-2026-00001",
            "TKT-2026-00002",
            "TKT-2026-00003",
        ]);
    });

    // API-035
    it("API-035: defaults to page 1, pageSize 10 with correct pagination metadata", async () => {
        for (let i = 1; i <= 25; i++) {
            await createTicket({
                ticketNumber: `TKT-2026-${String(i).padStart(5, "0")}`,
                summary: `Ticket ${i}`,
                createdAt: new Date(
                    `2026-09-${String((i % 20) + 1).padStart(2, "0")}T10:00:00.000Z`
                ),
            });
        }

        const res = await request(app)
            .get("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(10);

        expect(res.body.pagination).toEqual({
            page: 1,
            pageSize: 10,
            totalItems: 25,
            totalPages: 3,
            hasNextPage: true,
            hasPreviousPage: false,
        });
    });

    // API-036
    it("API-036: supports page sizes 20 and 50", async () => {
        for (let i = 1; i <= 25; i++) {
            await createTicket({
                ticketNumber: `TKT-2026-${String(i).padStart(5, "0")}`,
                summary: `Ticket ${i}`,
            });
        }

        const size20 = await request(app)
            .get("/api/v1/tickets?pageSize=20")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(size20.status).toBe(200);
        expect(size20.body.data).toHaveLength(20);
        expect(size20.body.pagination.pageSize).toBe(20);

        const size50 = await request(app)
            .get("/api/v1/tickets?pageSize=50")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(size50.status).toBe(200);
        expect(size50.body.data).toHaveLength(25);
        expect(size50.body.pagination.pageSize).toBe(50);
    });

    // API-037
    it("API-037: rejects invalid pagination and sort parameters", async () => {
        const invalidQueries = [
            "page=0",
            "pageSize=15",
            "sortBy=invalid",
            "requestedPriority=Critical",
            "currentStatus=Closed",
            "categoryId=abc",
        ];

        for (const query of invalidQueries) {
            const res = await request(app)
                .get(`/api/v1/tickets?${query}`)
                .set("X-Development-Requester-Id", ALICE_ID);

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INVALID_QUERY_PARAMS");
            expect(res.body.error).toHaveProperty("correlationId");
        }
    });

    it("returns empty result pagination when requester has no tickets", async () => {
        const res = await request(app)
            .get("/api/v1/tickets")
            .set("X-Development-Requester-Id", ALICE_ID);

        expect(res.status).toBe(200);

        expect(res.body).toEqual({
            data: [],
            pagination: {
                page: 1,
                pageSize: 10,
                totalItems: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        });
    });
});