import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
    saveAttachmentBinary,
} from "../../src/services/attachmentStorage.js";

describe("Feature-G: Attachment Lifecycle API", () => {
    const prisma = getPrisma();

    const ALICE_ID =
        "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    const BOB_ID =
        "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

    let ticketId: string;
    let attachmentId: string;

    const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x00,
    ]);

    beforeEach(async () => {
        await prisma.ticketEvent.deleteMany();
        await prisma.attachment.deleteMany();
        await prisma.ticket.deleteMany();
        await prisma.ticketSequence.deleteMany();

        const category =
            await prisma.category.upsert({
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

        const system =
            await prisma.relatedSystem.upsert({
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

        const ticket = await prisma.ticket.create({
            data: {
                ticketNumber:
                    `TKT-2026-${Math.floor(
                        Math.random() * 90000 + 10000
                    )}`,
                currentStatus: "New",
                requestedPriority: "Medium",
                summary: "Attachment lifecycle ticket",
                description:
                    "Used to test attachment retrieval and removal.",
                clientRequestId: randomUUID(),
                requesterId: ALICE_ID,
                categoryId: category.id,
                relatedSystemId: system.id,
            },
        });

        ticketId = ticket.id;

        const storageKey =
            await saveAttachmentBinary(
                pngBuffer,
                "image/png"
            );

        const attachment =
            await prisma.attachment.create({
                data: {
                    ticketId,
                    originalFilename:
                        "evidence.png",
                    mimeType: "image/png",
                    sizeBytes: pngBuffer.length,
                    storageKey,
                },
            });

        attachmentId = attachment.id;
    });

    it("API-048: returns attachment metadata without storage key", async () => {
        const res = await request(app)
            .get(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(200);

        expect(res.body.data).toMatchObject({
            id: attachmentId,
            ticketId,
            originalFilename:
                "evidence.png",
            mimeType: "image/png",
            sizeBytes: pngBuffer.length,
            isRemoved: false,
            removedAt: null,
            removalReason: null,
            removedByRequesterId: null,
        });

        expect(
            res.body.data
        ).not.toHaveProperty("storageKey");
    });

    it("API-049: returns neutral 404 for cross-requester metadata access", async () => {
        const res = await request(app)
            .get(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}`
            )
            .set(
                "X-Development-Requester-Id",
                BOB_ID
            );

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe(
            "ATTACHMENT_NOT_FOUND"
        );
    });

    it("API-050: streams active image inline for preview", async () => {
        const res = await request(app)
            .get(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}/download?inline=true`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain(
            "image/png"
        );
        expect(
            res.headers["content-disposition"]
        ).toContain("inline");
        expect(
            res.headers["content-disposition"]
        ).toContain("evidence.png");
    });

    it("API-051: streams attachment for download", async () => {
        const res = await request(app)
            .get(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}/download?inline=false`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain(
            "image/png"
        );
        expect(
            res.headers["content-disposition"]
        ).toContain("attachment");
    });

    it("API-052: returns neutral 404 for cross-requester download", async () => {
        const res = await request(app)
            .get(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}/download?inline=false`
            )
            .set(
                "X-Development-Requester-Id",
                BOB_ID
            );

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe(
            "ATTACHMENT_NOT_FOUND"
        );
    });

    it("API-053: soft-removes attachment and creates audit event", async () => {
        const res = await request(app)
            .delete(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .send({
                reason:
                    "Uploaded the wrong screenshot",
            });

        expect(res.status).toBe(200);

        expect(res.body.data).toMatchObject({
            id: attachmentId,
            ticketId,
            originalFilename:
                "evidence.png",
            isRemoved: true,
            removalReason:
                "Uploaded the wrong screenshot",
            removedByRequesterId:
                ALICE_ID,
        });

        expect(
            res.body.data.removedAt
        ).toBeTruthy();

        const stored =
            await prisma.attachment.findUniqueOrThrow({
                where: {
                    id: attachmentId,
                },
            });

        expect(stored.isRemoved).toBe(true);
        expect(
            stored.removalReason
        ).toBe(
            "Uploaded the wrong screenshot"
        );

        const event =
            await prisma.ticketEvent.findFirst({
                where: {
                    ticketId,
                    attachmentId,
                    eventType:
                        "ATTACHMENT_REMOVED",
                },
            });

        expect(event).not.toBeNull();
        expect(
            event?.actorRequesterId
        ).toBe(ALICE_ID);
    });

    it("API-054: rejects whitespace-only removal reason", async () => {
        const res = await request(app)
            .delete(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .send({
                reason: "   ",
            });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(
            "INVALID_REMOVAL_REASON"
        );
    });

    it("rejects removal reason longer than 200 characters", async () => {
        const res = await request(app)
            .delete(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .send({
                reason: "a".repeat(201),
            });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(
            "INVALID_REMOVAL_REASON"
        );
    });

    it("API-057: removed attachment cannot be downloaded", async () => {
        await request(app)
            .delete(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .send({
                reason: "No longer needed",
            });

        const res = await request(app)
            .get(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}/download?inline=false`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe(
            "ATTACHMENT_NOT_FOUND"
        );
    });

    it("returns 409 when removing an already removed attachment", async () => {
        await request(app)
            .delete(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .send({
                reason: "First removal",
            });

        const res = await request(app)
            .delete(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .send({
                reason: "Second removal",
            });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe(
            "ATTACHMENT_ALREADY_REMOVED"
        );
    });

    it("API-058: removal frees an active attachment slot", async () => {
        await prisma.attachment.deleteMany();

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

        const first =
            await prisma.attachment.findFirstOrThrow({
                where: {
                    ticketId,
                    isRemoved: false,
                },
            });

        const removeRes = await request(app)
            .delete(
                `/api/v1/tickets/${ticketId}/attachments/${first.id}`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            )
            .send({
                reason: "Free one slot",
            });

        expect(removeRes.status).toBe(200);

        const uploadRes = await request(app)
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
                    filename: "replacement.png",
                    contentType: "image/png",
                }
            );

        expect(uploadRes.status).toBe(201);
        expect(
            uploadRes.body.data.activeAttachmentCount
        ).toBe(5);
    });

    it("API-059: returns neutral 404 for cross-requester removal", async () => {
        const res = await request(app)
            .delete(
                `/api/v1/tickets/${ticketId}/attachments/${attachmentId}`
            )
            .set(
                "X-Development-Requester-Id",
                BOB_ID
            )
            .send({
                reason: "Attempted removal",
            });

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe(
            "ATTACHMENT_NOT_FOUND"
        );
    });

    it("API-060: rejects malformed attachment ID", async () => {
        const res = await request(app)
            .get(
                `/api/v1/tickets/${ticketId}/attachments/not-a-valid-id`
            )
            .set(
                "X-Development-Requester-Id",
                ALICE_ID
            );

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(
            "INVALID_ATTACHMENT_ID"
        );
    });
});