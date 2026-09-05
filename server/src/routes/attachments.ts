import { Router, Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";

import { getPrisma } from "../prisma.js";
import { requireDevelopmentRequester } from "../middleware/requesterContext.js";
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
    requireDevelopmentRequester,
    upload.array("files", 10),
    async (req: Request, res: Response) => {
        const requester = req.requester;
        const { ticketId } = req.params;

        if (!requester) {
            return res.status(400).json({
                error: {
                    code: "MISSING_REQUESTER_HEADER",
                    message:
                        "Development Requester context is required.",
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
            const ticket = await findOwnedTicket(
                ticketId,
                requester.id
            );

            if (!ticket) {
                return sendTicketNotFound(res);
            }

            const files = Array.isArray(req.files)
                ? req.files
                : [];

            if (files.length === 0) {
                return sendNoValidFiles(res, []);
            }

            const activeCount =
                await prisma.attachment.count({
                    where: {
                        ticketId,
                        isRemoved: false,
                    },
                });

            let remainingCapacity = Math.max(
                0,
                MAX_ACTIVE_ATTACHMENTS - activeCount
            );

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

                if (remainingCapacity <= 0) {
                    rejected.push({
                        filename: file.originalname,
                        reason:
                            "Ticket attachment limit reached (maximum 5 active attachments).",
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
                    storageKey =
                        await saveAttachmentBinary(
                            file.buffer,
                            detectedMimeType
                        );

                    const attachment =
                        await prisma.attachment.create({
                            data: {
                                ticketId,
                                originalFilename:
                                    file.originalname,
                                mimeType:
                                    detectedMimeType,
                                sizeBytes: file.size,
                                storageKey,
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

                    remainingCapacity -= 1;
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

            const newActiveCount =
                activeCount + accepted.length;

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
    requireDevelopmentRequester,
    async (req: Request, res: Response) => {
        const requester = req.requester;
        const { ticketId, attachmentId } =
            req.params;

        if (!requester) {
            return res.status(400).json({
                error: {
                    code: "MISSING_REQUESTER_HEADER",
                    message:
                        "Development Requester context is required.",
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
    requireDevelopmentRequester,
    async (req: Request, res: Response) => {
        const requester = req.requester;
        const { ticketId, attachmentId } =
            req.params;

        if (!requester) {
            return res.status(400).json({
                error: {
                    code: "MISSING_REQUESTER_HEADER",
                    message:
                        "Development Requester context is required.",
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
    requireDevelopmentRequester,
    async (req: Request, res: Response) => {
        const requester = req.requester;
        const { ticketId, attachmentId } =
            req.params;

        if (!requester) {
            return res.status(400).json({
                error: {
                    code: "MISSING_REQUESTER_HEADER",
                    message:
                        "Development Requester context is required.",
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
            reason.length > 200
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
                        const updated =
                            await tx.attachment.update({
                                where: {
                                    id: attachment.id,
                                },
                                data: {
                                    isRemoved: true,
                                    removedAt,
                                    removedByRequesterId:
                                        requester.id,
                                    removalReason: reason,
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
        } catch {
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