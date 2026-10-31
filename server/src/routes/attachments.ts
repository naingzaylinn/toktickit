import { Router, Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";

import { getPrisma } from "../prisma.js";
import { requireRequester } from "../middleware/requesterContext.js";
import {
    MAX_ACTIVE_ATTACHMENTS,
    validateAttachmentFile,
} from "../services/attachmentValidation.js";
import {
    deleteAttachmentBinary,
    readAttachmentBinary,
    saveAttachmentBinary,
} from "../services/attachmentStorage.js";

export const attachmentsRouter = Router({
    mergeParams: true,
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 10,
        fileSize: 6 * 1024 * 1024,
    },
});

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class AttachmentAlreadyRemoved extends Error {}

function sendTicketNotFound(res: Response) {
    return res.status(404).json({
        error: {
            code: "TICKET_NOT_FOUND",
            message: "Ticket not found.",
            correlationId: randomUUID(),
        },
    });
}

function sendAttachmentNotFound(res: Response) {
    return res.status(404).json({
        error: {
            code: "ATTACHMENT_NOT_FOUND",
            message: "Attachment not found or no longer available.",
            correlationId: randomUUID(),
        },
    });
}

function sendNoValidFiles(
    res: Response,
    rejected: Array<{
        filename: string;
        reason: string;
    }>
) {
    return res.status(400).json({
        error: {
            code: "NO_VALID_FILES",
            message:
                "No valid files were provided for upload.",
            correlationId: randomUUID(),
            details: [
                {
                    field: "files",
                    message:
                        "All selected files were rejected due to format, size, or capacity constraints.",
                },
            ],
        },
        data: {
            accepted: [],
            rejected,
        },
    });
}

async function findOwnedTicket(
    ticketId: string,
    requesterId: string
) {
    const prisma = getPrisma();

    return prisma.ticket.findFirst({
        where: {
            id: ticketId,
            requesterId,
        },
        select: {
            id: true,
        },
    });
}

// ---------------------------------------------------------------------------
// Feature-G — POST /api/v1/tickets/:ticketId/attachments
// ---------------------------------------------------------------------------
attachmentsRouter.post(
    "/",
    requireRequester,
    async (req, res, next) => {
        // Ownership precedes parser/content-type errors, preserving neutral
        // foreign-resource responses and avoiding buffering unauthorized files.
        if (!uuidPattern.test(req.params.ticketId)) return res.status(400).json({ error: {
            code: "INVALID_TICKET_ID", message: "Ticket ID must be a valid UUID.", correlationId: randomUUID(),
        } });
        try {
            if (!await findOwnedTicket(req.params.ticketId, req.auth!.user.id)) return sendTicketNotFound(res);
            next();
        } catch {
            return res.status(500).json({ error: { code: "ATTACHMENT_UPLOAD_FAILED", message: "Failed to upload attachment.", correlationId: randomUUID() } });
        }
    },
    (req, res, next) => {
        if (req.headers["content-type"] && !req.is("multipart/form-data")) return res.status(415).json({ error: {
            code: "UNSUPPORTED_CONTENT_TYPE", message: "Use multipart/form-data for attachment uploads.", correlationId: randomUUID(),
        } });
        upload.array("files", 10)(req, res, error => {
            if (!error) return next();
            const oversized = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
            return res.status(oversized ? 413 : 400).json({ error: {
                code: oversized ? "UPLOAD_TOO_LARGE" : "INVALID_MULTIPART",
                message: oversized ? "File exceeds the upload transport limit." : "Use a valid multipart upload with at most 10 files in the files field.",
                correlationId: randomUUID(),
            } });
        });
    },
    async (req: Request, res: Response) => {
        const requester = req.auth?.user;
        const { ticketId } = req.params;

        if (!requester) {
            return res.status(401).json({
                error: {
                    code: "AUTHENTICATION_REQUIRED",
                    message:
                        "Authentication is required.",
                    correlationId: randomUUID(),
                },
            });
        }

        if (!uuidPattern.test(ticketId)) {
            return res.status(400).json({
                error: {
                    code: "INVALID_TICKET_ID",
                    message:
                        "Ticket ID must be a valid UUID.",
                    correlationId: randomUUID(),
                },
            });
        }

        const prisma = getPrisma();

        try {
            const files = Array.isArray(req.files)
                ? req.files
                : [];

            if (files.length === 0) {
                return sendNoValidFiles(res, []);
            }

            const accepted: Array<{
                id: string;
                ticketId: string;
                originalFilename: string;
                mimeType: string;
                sizeBytes: number;
                createdAt: Date;
                isRemoved: false;
            }> = [];

            const rejected: Array<{
                filename: string;
                reason: string;
            }> = [];

            for (const file of files) {
                const validation =
                    validateAttachmentFile(file);

                if (!validation.valid) {
                    rejected.push({
                        filename: file.originalname,
                        reason:
                            validation.reason ??
                            "Unsupported attachment.",
                    });

                    continue;
                }

                const detectedMimeType =
                    validation.detectedMimeType;

                if (!detectedMimeType) {
                    rejected.push({
                        filename: file.originalname,
                        reason:
                            "Unsupported file format. Allowed formats: JPG, PNG, WEBP, PDF.",
                    });

                    continue;
                }

                let storageKey: string | null = null;

                try {
                    const savedKey =
                        await saveAttachmentBinary(
                            file.buffer,
                            detectedMimeType
                        );
                    storageKey = savedKey;

                    // Stage the binary before acquiring the parent lock. Capacity
                    // and metadata commit together; every losing path compensates.
                    const attachment = await prisma.$transaction(async tx => {
                        const parent = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} AND "requesterId" = ${requester.id} FOR UPDATE`;
                        if (!parent.length) throw new Error("Ticket unavailable");
                        const count = await tx.attachment.count({ where: { ticketId, isRemoved: false } });
                        if (count >= MAX_ACTIVE_ATTACHMENTS) return null;
                        return tx.attachment.create({
                            data: {
                                ticketId,
                                originalFilename:
                                    file.originalname,
                                mimeType:
                                    detectedMimeType,
                                sizeBytes: file.size,
                                storageKey: savedKey,
                            },
                            select: {
                                id: true,
                                ticketId: true,
                                originalFilename: true,
                                mimeType: true,
                                sizeBytes: true,
                                createdAt: true,
                                isRemoved: true,
                            },
                        });
                    });
                    if (!attachment) {
                        await deleteAttachmentBinary(storageKey);
                        storageKey = null;
                        rejected.push({ filename: file.originalname, reason: "Ticket attachment limit reached (maximum 5 active attachments)." });
                        continue;
                    }

                    accepted.push({
                        id: attachment.id,
                        ticketId:
                            attachment.ticketId,
                        originalFilename:
                            attachment.originalFilename,
                        mimeType:
                            attachment.mimeType,
                        sizeBytes:
                            attachment.sizeBytes,
                        createdAt:
                            attachment.createdAt,
                        isRemoved: false,
                    });

                } catch {
                    if (storageKey) {
                        try {
                            await deleteAttachmentBinary(
                                storageKey
                            );
                        } catch {
                            // storage cleanup failure is intentionally hidden
                        }
                    }

                    rejected.push({
                        filename: file.originalname,
                        reason:
                            "Failed to store attachment.",
                    });
                }
            }

            const newActiveCount = await prisma.attachment.count({ where: { ticketId, isRemoved: false } });

            if (accepted.length === 0) {
                return sendNoValidFiles(
                    res,
                    rejected
                );
            }

            return res.status(201).json({
                data: {
                    accepted,
                    rejected,
                    activeAttachmentCount:
                        newActiveCount,
                },
            });
        } catch {
            return res.status(500).json({
                error: {
                    code:
                        "ATTACHMENT_UPLOAD_FAILED",
                    message:
                        "Failed to upload attachment.",
                    correlationId: randomUUID(),
                },
            });
        }
    }
);

// ---------------------------------------------------------------------------
// Feature-G — GET attachment metadata
// GET /api/v1/tickets/:ticketId/attachments/:attachmentId
// ---------------------------------------------------------------------------
attachmentsRouter.get(
    "/:attachmentId",
    requireRequester,
    async (req: Request, res: Response) => {
        const requester = req.auth?.user;
        const { ticketId, attachmentId } =
            req.params;

        if (!requester) {
            return res.status(401).json({
                error: {
                    code: "AUTHENTICATION_REQUIRED",
                    message:
                        "Authentication is required.",
                    correlationId: randomUUID(),
                },
            });
        }

        if (
            !uuidPattern.test(ticketId) ||
            !uuidPattern.test(attachmentId)
        ) {
            return res.status(400).json({
                error: {
                    code: "INVALID_ATTACHMENT_ID",
                    message:
                        "Ticket ID and Attachment ID must be valid UUIDs.",
                    correlationId: randomUUID(),
                },
            });
        }

        const prisma = getPrisma();

        try {
            const attachment =
                await prisma.attachment.findFirst({
                    where: {
                        id: attachmentId,
                        ticketId,
                        ticket: {
                            requesterId: requester.id,
                        },
                    },
                    select: {
                        id: true,
                        ticketId: true,
                        originalFilename: true,
                        mimeType: true,
                        sizeBytes: true,
                        isRemoved: true,
                        removedAt: true,
                        removalReason: true,
                        removedByRequesterId: true,
                        createdAt: true,
                    },
                });

            if (!attachment) {
                return sendAttachmentNotFound(res);
            }

            return res.status(200).json({
                data: attachment,
            });
        } catch {
            return res.status(500).json({
                error: {
                    code:
                        "ATTACHMENT_METADATA_FAILED",
                    message:
                        "Failed to retrieve attachment metadata.",
                    correlationId: randomUUID(),
                },
            });
        }
    }
);

// ---------------------------------------------------------------------------
// Feature-G — GET attachment binary
// GET /api/v1/tickets/:ticketId/attachments/:attachmentId/download
// ---------------------------------------------------------------------------
attachmentsRouter.get(
    "/:attachmentId/download",
    requireRequester,
    async (req: Request, res: Response) => {
        const requester = req.auth?.user;
        const { ticketId, attachmentId } =
            req.params;

        if (!requester) {
            return res.status(401).json({
                error: {
                    code: "AUTHENTICATION_REQUIRED",
                    message:
                        "Authentication is required.",
                    correlationId: randomUUID(),
                },
            });
        }

        if (
            !uuidPattern.test(ticketId) ||
            !uuidPattern.test(attachmentId)
        ) {
            return res.status(400).json({
                error: {
                    code: "INVALID_ATTACHMENT_ID",
                    message:
                        "Ticket ID and Attachment ID must be valid UUIDs.",
                    correlationId: randomUUID(),
                },
            });
        }

        const prisma = getPrisma();

        try {
            const attachment =
                await prisma.attachment.findFirst({
                    where: {
                        id: attachmentId,
                        ticketId,
                        isRemoved: false,
                        ticket: {
                            requesterId: requester.id,
                        },
                    },
                    select: {
                        originalFilename: true,
                        mimeType: true,
                        storageKey: true,
                    },
                });

            if (!attachment) {
                return sendAttachmentNotFound(res);
            }

            const binary =
                await readAttachmentBinary(
                    attachment.storageKey
                );

            const inline =
                req.query.inline === "true";

            const dispositionType = inline
                ? "inline"
                : "attachment";

            const safeFilename =
                attachment.originalFilename.replace(
                    /["\r\n]/g,
                    "_"
                );

            res.setHeader(
                "Content-Type",
                attachment.mimeType
            );

            res.setHeader(
                "Content-Disposition",
                `${dispositionType}; filename="${safeFilename}"`
            );

            return res.status(200).send(binary);
        } catch {
            return res.status(500).json({
                error: {
                    code: "DOWNLOAD_FAILED",
                    message:
                        "Failed to stream attachment content.",
                    correlationId: randomUUID(),
                },
            });
        }
    }
);

// ---------------------------------------------------------------------------
// Feature-G — DELETE attachment
// DELETE /api/v1/tickets/:ticketId/attachments/:attachmentId
// ---------------------------------------------------------------------------
attachmentsRouter.delete(
    "/:attachmentId",
    requireRequester,
    async (req: Request, res: Response) => {
        const requester = req.auth?.user;
        const { ticketId, attachmentId } =
            req.params;

        if (!requester) {
            return res.status(401).json({
                error: {
                    code: "AUTHENTICATION_REQUIRED",
                    message:
                        "Authentication is required.",
                    correlationId: randomUUID(),
                },
            });
        }

        if (
            !uuidPattern.test(ticketId) ||
            !uuidPattern.test(attachmentId)
        ) {
            return res.status(400).json({
                error: {
                    code: "INVALID_ATTACHMENT_ID",
                    message:
                        "Ticket ID and Attachment ID must be valid UUIDs.",
                    correlationId: randomUUID(),
                },
            });
        }

        const reason =
            typeof req.body?.reason === "string"
                ? req.body.reason.trim()
                : "";

        if (
            reason.length < 1 ||
            reason.length > 200 || reason.includes("\u0000")
        ) {
            return res.status(400).json({
                error: {
                    code:
                        "INVALID_REMOVAL_REASON",
                    message:
                        "Removal reason is required and must contain 1-200 characters.",
                    correlationId: randomUUID(),
                    details: [
                        {
                            field: "reason",
                            message:
                                "Reason cannot be empty, whitespace-only, or longer than 200 characters.",
                        },
                    ],
                },
            });
        }

        const prisma = getPrisma();

        try {
            const attachment =
                await prisma.attachment.findFirst({
                    where: {
                        id: attachmentId,
                        ticketId,
                        ticket: {
                            requesterId: requester.id,
                        },
                    },
                    select: {
                        id: true,
                        ticketId: true,
                        originalFilename: true,
                        mimeType: true,
                        sizeBytes: true,
                        storageKey: true,
                        isRemoved: true,
                        createdAt: true,
                    },
                });

            if (!attachment) {
                return sendAttachmentNotFound(res);
            }

            if (attachment.isRemoved) {
                return res.status(409).json({
                    error: {
                        code:
                            "ATTACHMENT_ALREADY_REMOVED",
                        message:
                            "Attachment has already been removed.",
                        correlationId: randomUUID(),
                    },
                });
            }

            const removedAt = new Date();

            const tombstone =
                await prisma.$transaction(
                    async (tx) => {
                        // Parent -> attachment ordering is shared with uploads.
                        await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} AND "requesterId" = ${requester.id} FOR UPDATE`;
                        const changed = await tx.attachment.updateMany({
                            where: { id: attachment.id, ticketId, isRemoved: false, ticket: { requesterId: requester.id } },
                            data: { isRemoved: true, removedAt, removedByRequesterId: requester.id, removalReason: reason },
                        });
                        if (changed.count !== 1) throw new AttachmentAlreadyRemoved();
                        const updated =
                            await tx.attachment.findUniqueOrThrow({
                                where: {
                                    id: attachment.id,
                                },
                                select: {
                                    id: true,
                                    ticketId: true,
                                    originalFilename: true,
                                    mimeType: true,
                                    sizeBytes: true,
                                    isRemoved: true,
                                    removedAt: true,
                                    removalReason: true,
                                    removedByRequesterId: true,
                                    createdAt: true,
                                },
                            });

                        await tx.ticketEvent.create({
                            data: {
                                ticketId,
                                attachmentId:
                                    attachment.id,
                                actorRequesterId:
                                    requester.id,
                                eventType:
                                    "ATTACHMENT_REMOVED",
                                details: {
                                    filename:
                                        attachment.originalFilename,
                                    reason,
                                },
                            },
                        });

                        return updated;
                    }
                );

            try {
                await deleteAttachmentBinary(
                    attachment.storageKey
                );
            } catch (error) {
                console.error(
                    "Attachment binary cleanup failed:",
                    error
                );
            }

            return res.status(200).json({
                data: tombstone,
            });
        } catch (error) {
            if (error instanceof AttachmentAlreadyRemoved) return res.status(409).json({ error: {
                code: "ATTACHMENT_ALREADY_REMOVED", message: "Attachment has already been removed.", correlationId: randomUUID(),
            } });
            return res.status(500).json({
                error: {
                    code:
                        "ATTACHMENT_REMOVAL_FAILED",
                    message:
                        "Failed to remove attachment.",
                    correlationId: randomUUID(),
                },
            });
        }
    }
);

export default attachmentsRouter;
