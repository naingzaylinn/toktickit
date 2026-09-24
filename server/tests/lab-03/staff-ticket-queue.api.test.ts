import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterCookie } from "./sessionFixture.js";

const prisma = getPrisma();

const requesterId = randomUUID();
const secondRequesterId = randomUUID();
const staffId = randomUUID();
const secondStaffId = randomUUID();
const adminId = randomUUID();
const passwordChangeStaffId = randomUUID();

let requesterCookieValue: string;
let staffCookie: string;
let adminCookie: string;
let passwordChangeCookie: string;

let categoryId: number;
let systemId: string;

const ticketIds: string[] = [];

beforeAll(async () => {
    // Create users for each role needed by the queue tests.
    await prisma.user.createMany({
        data: [
            {
                id: requesterId,
                name: "Queue Requester Alpha",
                email: `${requesterId}@queue.test`,
                role: "REQUESTER",
                passwordHash: "fixture-not-a-password",
                mustChangePassword: false,
            },
            {
                id: secondRequesterId,
                name: "Queue Requester Beta",
                email: `${secondRequesterId}@queue.test`,
                role: "REQUESTER",
                passwordHash: "fixture-not-a-password",
                mustChangePassword: false,
            },
            {
                id: staffId,
                name: "Queue Staff One",
                email: `${staffId}@queue.test`,
                role: "IT_STAFF",
                passwordHash: "fixture-not-a-password",
                mustChangePassword: false,
            },
            {
                id: secondStaffId,
                name: "Queue Staff Two",
                email: `${secondStaffId}@queue.test`,
                role: "IT_STAFF",
                passwordHash: "fixture-not-a-password",
                mustChangePassword: false,
            },
            {
                id: adminId,
                name: "Queue Administrator",
                email: `${adminId}@queue.test`,
                role: "ADMINISTRATOR",
                passwordHash: "fixture-not-a-password",
                mustChangePassword: false,
            },
            {
    id: passwordChangeStaffId,
    name: "Queue Password Change Staff",
    email: `${passwordChangeStaffId}@queue.test`,
    role: "IT_STAFF",
    passwordHash: "fixture-not-a-password",
    mustChangePassword: false,
},
        ],
    });

    // Create authenticated sessions.
    [
        requesterCookieValue,
        staffCookie,
        adminCookie,
        passwordChangeCookie,
    ] = await Promise.all([
        requesterCookie(requesterId),
        requesterCookie(staffId),
        requesterCookie(adminId),
        requesterCookie(passwordChangeStaffId),
    ]);

    // Reuse existing active reference data.
    categoryId = (
        await prisma.category.findFirstOrThrow({
            where: { isActive: true },
        })
    ).id;

    systemId = (
        await prisma.relatedSystem.findFirstOrThrow({
            where: { isActive: true },
        })
    ).id;

    const base = {
    categoryId,
    relatedSystemId: systemId,
    description: "Staff queue fixture description",
};

    // Create queue fixtures with different statuses, priorities and owners.
    // Each ticket gets its own clientRequestId.
    const created = await Promise.all([
        prisma.ticket.create({
            data: {
                ...base,
                clientRequestId: randomUUID(),
                requesterId,
                ticketNumber: `QUEUE-${randomUUID()}`,
                summary: "Wireless outage alpha",
                requestedPriority: "High",
                itPriority: "Urgent",
                currentStatus: "Open",
                ownerId: staffId,
            },
        }),

        prisma.ticket.create({
            data: {
                ...base,
                clientRequestId: randomUUID(),
                requesterId: secondRequesterId,
                ticketNumber: `QUEUE-${randomUUID()}`,
                summary: "Printer toner beta",
                requestedPriority: "Low",
                itPriority: "Medium",
                currentStatus: "WaitingForRequester",
                ownerId: null,
            },
        }),

        prisma.ticket.create({
            data: {
                ...base,
                clientRequestId: randomUUID(),
                requesterId,
                ticketNumber: `QUEUE-${randomUUID()}`,
                summary: "VPN connection gamma",
                requestedPriority: "Urgent",
                itPriority: "High",
                currentStatus: "InProgress",
                ownerId: secondStaffId,
            },
        }),
    ]);

    ticketIds.push(...created.map((ticket) => ticket.id));
});

afterAll(async () => {
    // Delete queue fixtures first because they reference users.
    await prisma.ticket.deleteMany({
        where: {
            id: {
                in: ticketIds,
            },
        },
    });

    // Delete sessions before deleting their users.
    await prisma.session.deleteMany({
        where: {
            userId: {
                in: [
                    requesterId,
                    secondRequesterId,
                    staffId,
                    secondStaffId,
                    adminId,
                    passwordChangeStaffId,
                ],
            },
        },
    });

    await prisma.user.deleteMany({
        where: {
            id: {
                in: [
                    requesterId,
                    secondRequesterId,
                    staffId,
                    secondStaffId,
                    adminId,
                    passwordChangeStaffId,
                ],
            },
        },
    });
});

describe("Staff Ticket Queue", () => {
    it("QUEUE-AUTH-01: requires authentication", async () => {
        const response = await request(app).get("/api/staff/tickets");

        expect(response.status).toBe(401);
        expect(response.body).not.toHaveProperty("data");
    });

    it("QUEUE-AUTH-02: forbids Requesters even with forged role headers", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .set("Cookie", requesterCookieValue)
            .set("X-Role", "ADMINISTRATOR");

        expect(response.status).toBe(403);
        expect(response.body).not.toHaveProperty("data");
    });

    it("QUEUE-AUTH-03: requires mandatory password change first", async () => {
    await prisma.user.update({
        where: { id: passwordChangeStaffId },
        data: { mustChangePassword: true },
    });

    const response = await request(app)
        .get("/api/staff/tickets")
        .set("Cookie", passwordChangeCookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(
        "PASSWORD_CHANGE_REQUIRED"
    );

    await prisma.user.update({
        where: { id: passwordChangeStaffId },
        data: { mustChangePassword: false },
    });
});

    it("QUEUE-AUTH-04: permits IT Staff", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);

        expect(response.body.meta).toEqual(
            expect.objectContaining({
                page: 1,
                pageSize: 20,
            })
        );
    });

    it("QUEUE-AUTH-05: permits Administrators", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .set("Cookie", adminCookie);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);

        expect(response.body.meta).toEqual(
            expect.objectContaining({
                page: 1,
                pageSize: 20,
            })
        );
    });

    it("QUEUE-DTO-01: returns only safe documented queue fields", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .query({
                search: "Wireless outage alpha",
            })
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);

        const ticket = response.body.data[0];

        expect(Object.keys(ticket).sort()).toEqual(
            [
                "id",
                "ticketNumber",
                "summary",
                "category",
                "requester",
                "requestedPriority",
                "itPriority",
                "status",
                "owner",
                "createdAt",
                "updatedAt",
            ].sort()
        );

        expect(ticket.requester).toEqual(
            expect.objectContaining({
                id: requesterId,
                name: "Queue Requester Alpha",
            })
        );

        expect(ticket.owner).toEqual(
            expect.objectContaining({
                id: staffId,
                name: "Queue Staff One",
            })
        );

        expect(response.text).not.toMatch(
            /passwordHash|mustChangePassword|internalNotes/
        );
    });

    it.each([
        ["ticket summary", "Wireless outage alpha"],
        ["requester name", "Queue Requester Alpha"],
        ["requester email", `${requesterId}@queue.test`],
    ])(
        "QUEUE-SEARCH-01: searches case-insensitively by %s",
        async (_label, search) => {
            const response = await request(app)
                .get("/api/staff/tickets")
                .query({
                    search: search.toLowerCase(),
                })
                .set("Cookie", staffCookie);

            expect(response.status).toBe(200);

            expect(
                response.body.data.some(
                    (ticket: { id: string }) =>
                        ticketIds.includes(ticket.id)
                )
            ).toBe(true);
        }
    );

    it("QUEUE-SEARCH-02: searches Ticket Number case-insensitively", async () => {
        const fixture = await prisma.ticket.findUniqueOrThrow({
            where: {
                id: ticketIds[0],
            },
        });

        const response = await request(app)
            .get("/api/staff/tickets")
            .query({
                search: fixture.ticketNumber.toLowerCase(),
            })
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);

        expect(
            response.body.data.some(
                (ticket: { id: string }) =>
                    ticket.id === fixture.id
            )
        ).toBe(true);
    });

    it("QUEUE-FILTER-01: filters by status and priorities", async () => {
    const response = await request(app)
        .get("/api/staff/tickets")
        .query({
            status: "OPEN",
            requestedPriority: "HIGH",
            itPriority: "URGENT",
        })
        .set("Cookie", staffCookie);

    expect(response.status).toBe(200);

    expect(
        response.body.data.some(
            (ticket: { id: string }) =>
                ticket.id === ticketIds[0]
        )
    ).toBe(true);

    for (const ticket of response.body.data) {
        expect(ticket.status).toBe("OPEN");
        expect(ticket.requestedPriority).toBe("HIGH");
        expect(ticket.itPriority).toBe("URGENT");
    }
});

    it("QUEUE-FILTER-02: filters assigned tickets", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .query({
                owner: "assigned",
            })
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);

        expect(
            response.body.data.every(
                (ticket: { owner: unknown }) =>
                    ticket.owner !== null
            )
        ).toBe(true);

        expect(
            response.body.data.some(
                (ticket: { id: string }) =>
                    ticket.id === ticketIds[0]
            )
        ).toBe(true);
    });

    it("QUEUE-FILTER-03: filters unassigned tickets", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .query({
                owner: "unassigned",
            })
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);

        expect(
            response.body.data.every(
                (ticket: { owner: unknown }) =>
                    ticket.owner === null
            )
        ).toBe(true);

        expect(
            response.body.data.some(
                (ticket: { id: string }) =>
                    ticket.id === ticketIds[1]
            )
        ).toBe(true);
    });

    it("QUEUE-FILTER-04: filters by a specific owner ID", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .query({
                owner: secondStaffId,
            })
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);

        for (const ticket of response.body.data) {
            expect(ticket.owner?.id).toBe(secondStaffId);
        }

        expect(
            response.body.data.some(
                (ticket: { id: string }) =>
                    ticket.id === ticketIds[2]
            )
        ).toBe(true);
    });

    it("QUEUE-FILTER-05: combines search and filters", async () => {
    const response = await request(app)
        .get("/api/staff/tickets")
        .query({
            search: "VPN connection gamma",
            status: "IN_PROGRESS",
            requestedPriority: "URGENT",
            itPriority: "HIGH",
            owner: secondStaffId,
        })
        .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(ticketIds[2]);
});

    it.each([
        "ticketNumber",
        "createdAt",
        "updatedAt",
        "status",
        "requestedPriority",
        "itPriority",
    ])(
        "QUEUE-SORT-01: accepts documented sort field %s",
        async (sort) => {
            const response = await request(app)
                .get("/api/staff/tickets")
                .query({
                    sort,
                    order: "asc",
                    pageSize: 50,
                })
                .set("Cookie", staffCookie);

            expect(response.status).toBe(200);
        }
    );

    it("QUEUE-SORT-02: applies ticket-number ascending sorting", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .query({
                search: "Queue Requester Alpha",
                sort: "ticketNumber",
                order: "asc",
                pageSize: 50,
            })
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);

        const numbers = response.body.data.map(
            (ticket: { ticketNumber: string }) =>
                ticket.ticketNumber
        );

        expect(numbers).toEqual([...numbers].sort());
    });

    it("QUEUE-SORT-03: defaults to updatedAt descending", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .query({
                pageSize: 50,
            })
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);

        const times = response.body.data.map(
            (ticket: { updatedAt: string }) =>
                new Date(ticket.updatedAt).getTime()
        );

        expect(times).toEqual(
            [...times].sort((a, b) => b - a)
        );
    });

    it("QUEUE-PAGE-01: uses documented default pagination", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);

        expect(response.body.meta).toEqual({
            page: 1,
            pageSize: 20,
            totalItems: expect.any(Number),
            totalPages: expect.any(Number),
        });
    });

    it.each([10, 20, 50])(
        "QUEUE-PAGE-02: accepts page size %i",
        async (pageSize) => {
            const response = await request(app)
                .get("/api/staff/tickets")
                .query({
                    page: 1,
                    pageSize,
                })
                .set("Cookie", staffCookie);

            expect(response.status).toBe(200);
            expect(response.body.meta.page).toBe(1);
            expect(response.body.meta.pageSize).toBe(pageSize);
            expect(response.body.data.length).toBeLessThanOrEqual(
                pageSize
            );
        }
    );

    it("QUEUE-PAGE-03: calculates pagination metadata", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .query({
                page: 1,
                pageSize: 10,
            })
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);

        expect(response.body.meta.totalPages).toBe(
            response.body.meta.totalItems === 0
                ? 0
                : Math.ceil(
                      response.body.meta.totalItems / 10
                  )
        );
    });

    it("QUEUE-EMPTY-01: returns a normal empty result for no matches", async () => {
        const response = await request(app)
            .get("/api/staff/tickets")
            .query({
                search: `no-match-${randomUUID()}`,
            })
            .set("Cookie", staffCookie);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
        expect(response.body.meta.totalItems).toBe(0);
        expect(response.body.meta.totalPages).toBe(0);
    });

    it.each([
        ["status", "NotAStatus"],
        ["requestedPriority", "Impossible"],
        ["itPriority", "Impossible"],
        ["sort", "passwordHash"],
        ["order", "sideways"],
        ["page", "0"],
        ["page", "-1"],
        ["page", "1.5"],
        ["page", "abc"],
        ["pageSize", "15"],
        ["pageSize", "0"],
    ])(
        "QUEUE-VALIDATION-01: rejects invalid %s=%s",
        async (key, value) => {
            const response = await request(app)
                .get("/api/staff/tickets")
                .query({
                    [key]: value,
                })
                .set("Cookie", staffCookie);

            expect(response.status).toBe(400);
            expect(response.body).not.toHaveProperty("data");
        }
    );

    it("QUEUE-VALIDATION-02: rejects an empty owner value", async () => {
        const response = await request(app)
            .get("/api/staff/tickets?owner=")
            .set("Cookie", staffCookie);

        expect(response.status).toBe(400);
        expect(response.body).not.toHaveProperty("data");
    });

    it("QUEUE-FAIL-01: unexpected failures do not disclose database details", async () => {
        vi.spyOn(prisma.ticket, "findMany").mockRejectedValueOnce(
            new Error("database secret queue failure")
        );

        const response = await request(app)
            .get("/api/staff/tickets")
            .set("Cookie", staffCookie);

        expect(response.status).toBe(500);
        expect(response.text).not.toContain(
            "database secret queue failure"
        );
        expect(response.body).not.toHaveProperty("data");
    });
});