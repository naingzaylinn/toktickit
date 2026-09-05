import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../prisma.js";
import { requireDevelopmentRequester } from "../middleware/requesterContext.js";
import {
    normalizePriority,
    validateCategoryId,
    validateClientRequestId,
    validateDescription,
    validateRelatedSystemId,
    validateSummary,
    ValidationDetail,
} from "../services/ticketValidation.js";
import { generateTicketNumber } from "../services/ticketNumber.js";

export const ticketsRouter = Router();

function sendValidationError(
    res: Response,
    details: ValidationDetail[]
) {
    return res.status(400).json({
        error: {
            code: "VALIDATION_ERROR",
            message: "One or more fields are invalid.",
            correlationId: randomUUID(),
            details,
        },
    });
}

ticketsRouter.post(
    "/",
    requireDevelopmentRequester,
    async (req: Request, res: Response) => {
        const requester = req.requester;

        if (!requester) {
            return res.status(400).json({
                error: {
                    code: "MISSING_REQUESTER_HEADER",
                    message: "Development Requester context is required.",
                    correlationId: randomUUID(),
                },
            });
        }

        const {
            categoryId,
            relatedSystemId,
            requestedPriority,
            summary,
            description,
            clientRequestId,
        } = req.body ?? {};

        const validationDetails: ValidationDetail[] = [];

        const categoryIdError = validateCategoryId(categoryId);
        if (categoryIdError) validationDetails.push(categoryIdError);

        const relatedSystemIdError =
            validateRelatedSystemId(relatedSystemId);
        if (relatedSystemIdError) {
            validationDetails.push(relatedSystemIdError);
        }

        const summaryError = validateSummary(summary);
        if (summaryError) validationDetails.push(summaryError);

        const descriptionError = validateDescription(description);
        if (descriptionError) validationDetails.push(descriptionError);

        const clientRequestIdError =
            validateClientRequestId(clientRequestId);
        if (clientRequestIdError) {
            validationDetails.push(clientRequestIdError);
        }

        const priority = normalizePriority(requestedPriority);

        if (!priority) {
            validationDetails.push({
                field: "requestedPriority",
                message:
                    "Requested Priority must be Low, Medium, High, or Urgent.",
            });
        }

        if (validationDetails.length > 0 || !priority) {
            return sendValidationError(res, validationDetails);
        }

        const validPriority = priority;

        const prisma = getPrisma();

        try {
            const category = await prisma.category.findUnique({
                where: {
                    id: categoryId,
                },
                select: {
                    id: true,
                    isActive: true,
                },
            });

            if (!category) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_CATEGORY",
                        message: "The selected Category does not exist.",
                        correlationId: randomUUID(),
                    },
                });
            }

            if (!category.isActive) {
                return res.status(400).json({
                    error: {
                        code: "INACTIVE_CATEGORY",
                        message: "The selected Category is inactive.",
                        correlationId: randomUUID(),
                    },
                });
            }

            const relatedSystem =
                await prisma.relatedSystem.findUnique({
                    where: {
                        id: relatedSystemId,
                    },
                    select: {
                        id: true,
                        isActive: true,
                    },
                });

            if (!relatedSystem) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_RELATED_SYSTEM",
                        message: "The selected Related System does not exist.",
                        correlationId: randomUUID(),
                    },
                });
            }

            if (!relatedSystem.isActive) {
                return res.status(400).json({
                    error: {
                        code: "INACTIVE_RELATED_SYSTEM",
                        message: "The selected Related System is inactive.",
                        correlationId: randomUUID(),
                    },
                });
            }

            const trimmedSummary = summary.trim();
            const trimmedDescription = description.trim();

            const existing = await prisma.ticket.findUnique({
                where: {
                    requesterId_clientRequestId: {
                        requesterId: requester.id,
                        clientRequestId,
                    },
                },
            });

            if (existing) {
                const exactReplay =
                    existing.categoryId === categoryId &&
                    existing.relatedSystemId === relatedSystemId &&
                    existing.requestedPriority === validPriority &&
                    existing.summary === trimmedSummary &&
                    existing.description === trimmedDescription;

                if (!exactReplay) {
                    return res.status(409).json({
                        error: {
                            code: "IDEMPOTENCY_CONFLICT",
                            message:
                                "This clientRequestId was already used with different ticket data.",
                            correlationId: randomUUID(),
                        },
                    });
                }

                res.setHeader("Idempotent-Replay", "true");

                return res.status(200).json({
                    data: {
                        id: existing.id,
                        ticketNumber: existing.ticketNumber,
                        ticketDate: existing.ticketDate,
                        currentStatus: existing.currentStatus,
                        requestedPriority: existing.requestedPriority,
                        summary: existing.summary,
                        description: existing.description,
                        requesterId: existing.requesterId,
                        categoryId: existing.categoryId,
                        relatedSystemId: existing.relatedSystemId,
                    },
                });
            }

            const now = new Date();
            const year = now.getUTCFullYear();

            const created = await prisma.$transaction(async (tx) => {
                const ticketNumber = await generateTicketNumber(
                    tx,
                    year
                );

                return tx.ticket.create({
                    data: {
                        ticketNumber,
                        ticketDate: now,
                        currentStatus: "New",
                        requestedPriority: validPriority,
                        summary: trimmedSummary,
                        description: trimmedDescription,
                        clientRequestId,
                        requesterId: requester.id,
                        categoryId,
                        relatedSystemId,
                    },
                });
            });

            return res.status(201).json({
                data: {
                    id: created.id,
                    ticketNumber: created.ticketNumber,
                    ticketDate: created.ticketDate,
                    currentStatus: created.currentStatus,
                    requestedPriority: created.requestedPriority,
                    summary: created.summary,
                    description: created.description,
                    requesterId: created.requesterId,
                    categoryId: created.categoryId,
                    relatedSystemId: created.relatedSystemId,
                },
            });
        } catch {
            return res.status(500).json({
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to create ticket.",
                    correlationId: randomUUID(),
                },
            });
        }
    }
);