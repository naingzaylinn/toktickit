import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Feature-G: Attachment Upload API", () => {
    const prisma = getPrisma();

    const ALICE_ID =
        "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    let categoryId: number;
    let relatedSystemId: string;
    let ticketId: string;

    const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x00,
    ]);

    const jpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0,
        0x00, 0x10, 0x4a, 0x46,
    ]);

    const pdfBuffer = Buffer.from(
        "%PDF-1.4\n% test file\n"
    );

    beforeEach(async () => {
        await prisma.ticketEvent.deleteMany();
        await prisma.attachment.deleteMany();
        await prisma.ticket.deleteMany();
        await prisma.ticketSequence.deleteMany();

        const category =
            await prisma.category.findUniqueOrThrow({
                where: {
                    name: "Hardware",
                },
            });

        const system =
            await prisma.relatedSystem.findUniqueOrThrow({
                where: {
                    name: "VPN",
                },
            });

        categoryId = category.id;
        relatedSystemId = system.id;

        const ticket = await prisma.ticket.create({
            data: {
                ticketNumber:
                    `TKT-2026-${Math.floor(
                        Math.random() * 90000 + 10000
                    )}`,
                currentStatus: "New",
                requestedPriority: "Medium",
                summary: "Attachment test ticket",
                description:
                    "Ticket used for attachment API testing.",
                clientRequestId: randomUUID(),
                requesterId: ALICE_ID,
                categoryId,
                relatedSystemId,
            },
        });

        ticketId = ticket.id;
    });

    it("API-042: uploads one valid attachment", async () => {
        const res = await request(app)
            .post(
                `/api/v1/tickets/${ticketId}/attachments`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .attach(
                "files",
                pngBuffer,
                {
                    filename: "screenshot.png",
                    contentType: "image/png",
                }
            );

        expect(res.status).toBe(201);

        expect(res.body.data.accepted).toHaveLength(1);
        expect(res.body.data.rejected).toHaveLength(0);
        expect(
            res.body.data.activeAttachmentCount
        ).toBe(1);

        expect(
            res.body.data.accepted[0]
        ).toMatchObject({
            ticketId,
            originalFilename: "screenshot.png",
            mimeType: "image/png",
            isRemoved: false,
        });

        const stored =
            await prisma.attachment.findFirst({
                where: {
                    ticketId,
                    isRemoved: false,
                },
            });

        expect(stored).not.toBeNull();
        expect(stored?.storageKey).toBeTruthy();
    });

    it("API-043: rejects unsupported file type", async () => {
        const res = await request(app)
            .post(
                `/api/v1/tickets/${ticketId}/attachments`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .attach(
                "files",
                Buffer.from("hello"),
                {
                    filename: "program.exe",
                    contentType:
                        "application/octet-stream",
                }
            );

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(
            "NO_VALID_FILES"
        );

        expect(
            res.body.data.rejected[0].reason
        ).toContain("Unsupported file format");
    });

    it("API-044: rejects file larger than 5 MB", async () => {
        const oversized = Buffer.concat([
            pngBuffer,
            Buffer.alloc(
                5 * 1024 * 1024 + 1
            ),
        ]);

        const res = await request(app)
            .post(
                `/api/v1/tickets/${ticketId}/attachments`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .attach(
                "files",
                oversized,
                {
                    filename: "large.png",
                    contentType: "image/png",
                }
            );

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(
            "NO_VALID_FILES"
        );

        expect(
            res.body.data.rejected[0].reason
        ).toContain("5 MB");
    });

    it("API-045: rejects mismatched file signature", async () => {
        const res = await request(app)
            .post(
                `/api/v1/tickets/${ticketId}/attachments`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .attach(
                "files",
                pdfBuffer,
                {
                    filename: "fake.png",
                    contentType: "image/png",
                }
            );

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(
            "NO_VALID_FILES"
        );

        expect(
            res.body.data.rejected[0].reason
        ).toContain("does not match");
    });

    it("API-046: enforces maximum of five active attachments", async () => {
        for (let i = 0; i < 5; i++) {
            await prisma.attachment.create({
                data: {
                    ticketId,
                    originalFilename:
                        `existing-${i}.png`,
                    mimeType: "image/png",
                    sizeBytes: pngBuffer.length,
                    storageKey:
                        `${randomUUID()}.png`,
                },
            });
        }

        const res = await request(app)
            .post(
                `/api/v1/tickets/${ticketId}/attachments`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .attach(
                "files",
                pngBuffer,
                {
                    filename: "sixth.png",
                    contentType: "image/png",
                }
            );

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(
            "NO_VALID_FILES"
        );

        expect(
            res.body.data.rejected[0].reason
        ).toContain(
            "maximum 5 active attachments"
        );

        expect(
            await prisma.attachment.count({
                where: {
                    ticketId,
                    isRemoved: false,
                },
            })
        ).toBe(5);
    });

    it("API-046B: partially accepts mixed valid, invalid, and excess files", async () => {
        for (let i = 0; i < 4; i++) {
            await prisma.attachment.create({
                data: {
                    ticketId,
                    originalFilename:
                        `existing-${i}.png`,
                    mimeType: "image/png",
                    sizeBytes: pngBuffer.length,
                    storageKey:
                        `${randomUUID()}.png`,
                },
            });
        }

        const res = await request(app)
            .post(
                `/api/v1/tickets/${ticketId}/attachments`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .attach(
                "files",
                pngBuffer,
                {
                    filename: "accepted.png",
                    contentType: "image/png",
                }
            )
            .attach(
                "files",
                Buffer.from("bad"),
                {
                    filename: "bad.exe",
                    contentType:
                        "application/octet-stream",
                }
            )
            .attach(
                "files",
                jpegBuffer,
                {
                    filename: "excess.jpg",
                    contentType: "image/jpeg",
                }
            );

        expect(res.status).toBe(201);

        expect(res.body.data.accepted).toHaveLength(1);
        expect(res.body.data.rejected).toHaveLength(2);
        expect(
            res.body.data.activeAttachmentCount
        ).toBe(5);

        expect(
            res.body.data.accepted[0]
                .originalFilename
        ).toBe("accepted.png");

        const reasons =
            res.body.data.rejected.map(
                (item: { reason: string }) =>
                    item.reason
            );

        expect(
            reasons.some((reason: string) =>
                reason.includes(
                    "Unsupported file format"
                )
            )
        ).toBe(true);

        expect(
            reasons.some((reason: string) =>
                reason.includes(
                    "maximum 5 active attachments"
                )
            )
        ).toBe(true);
    });

    it("API-047: allows duplicate original filenames", async () => {
        const res = await request(app)
            .post(
                `/api/v1/tickets/${ticketId}/attachments`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .attach(
                "files",
                pngBuffer,
                {
                    filename: "same-name.png",
                    contentType: "image/png",
                }
            )
            .attach(
                "files",
                pngBuffer,
                {
                    filename: "same-name.png",
                    contentType: "image/png",
                }
            );

        expect(res.status).toBe(201);
        expect(res.body.data.accepted).toHaveLength(2);

        const rows =
            await prisma.attachment.findMany({
                where: {
                    ticketId,
                },
                orderBy: {
                    createdAt: "asc",
                },
            });

        expect(rows).toHaveLength(2);

        expect(
            rows[0].originalFilename
        ).toBe("same-name.png");

        expect(
            rows[1].originalFilename
        ).toBe("same-name.png");

        expect(
            rows[0].storageKey
        ).not.toBe(
            rows[1].storageKey
        );
    });
});