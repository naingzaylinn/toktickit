import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
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

const ALLOWED_SORTS = [
    "newest",
    "oldest",
    "recentlyUpdated",
    "ticketNumberAsc",
] as const;

const ALLOWED_PAGE_SIZES = [10, 20, 50] as const;

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

function sendQueryError(
    res: Response,
    message: string
) {
    return res.status(400).json({
        error: {
            code: "INVALID_QUERY_PARAMS",
            message,
            correlationId: randomUUID(),
        },
    });
}

// ---------------------------------------------------------------------------
// Feature-E — GET /api/v1/tickets
// ---------------------------------------------------------------------------
ticketsRouter.get(
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

        const q =
            typeof req.query.q === "string"
                ? req.query.q.trim()
                : "";

        const categoryIdRaw =
            typeof req.query.categoryId === "string"
                ? req.query.categoryId
                : undefined;

        const relatedSystemId =
            typeof req.query.relatedSystemId === "string"
                ? req.query.relatedSystemId
                : undefined;

        const requestedPriority =
            typeof req.query.requestedPriority === "string"
                ? req.query.requestedPriority
                : undefined;

        const currentStatus =
            typeof req.query.currentStatus === "string"
                ? req.query.currentStatus
                : undefined;

        const sortBy =
            typeof req.query.sortBy === "string"
                ? req.query.sortBy
                : "newest";

        const pageRaw =
            typeof req.query.page === "string"
                ? req.query.page
                : "1";

        const pageSizeRaw =
            typeof req.query.pageSize === "string"
                ? req.query.pageSize
                : "10";

        const page = Number(pageRaw);
        const pageSize = Number(pageSizeRaw);

        if (
            !Number.isInteger(page) ||
            page < 1
        ) {
            return sendQueryError(
                res,
                "Page must be an integer greater than or equal to 1."
            );
        }

        if (
            !Number.isInteger(pageSize) ||
            !ALLOWED_PAGE_SIZES.includes(
                pageSize as (typeof ALLOWED_PAGE_SIZES)[number]
            )
        ) {
            return sendQueryError(
                res,
                "Page size must be one of 10, 20, or 50."
            );
        }

        if (
            !ALLOWED_SORTS.includes(
                sortBy as (typeof ALLOWED_SORTS)[number]
            )
        ) {
            return sendQueryError(
                res,
                "Sort parameter is invalid."
            );
        }

        let categoryId: number | undefined;

        if (categoryIdRaw !== undefined) {
            categoryId = Number(categoryIdRaw);

            if (
                !Number.isInteger(categoryId) ||
                categoryId <= 0
            ) {
                return sendQueryError(
                    res,
                    "Category filter is invalid."
                );
            }
        }

        if (
            requestedPriority !== undefined &&
            normalizePriority(requestedPriority) !==
            requestedPriority
        ) {
            return sendQueryError(
                res,
                "Requested Priority filter is invalid."
            );
        }

        if (
            currentStatus !== undefined &&
            currentStatus !== "New"
        ) {
            return sendQueryError(
                res,
                "Current Status filter is invalid."
            );
        }

        const where: Prisma.TicketWhereInput = {
            requesterId: requester.id,
        };

        if (q) {
            where.OR = [
                {
                    ticketNumber: {
                        contains: q,
                        mode: "insensitive",
                    },
                },
                {
                    summary: {
                        contains: q,
                        mode: "insensitive",
                    },
                },
                {
                    description: {
                        contains: q,
                        mode: "insensitive",
                    },
                },
            ];
        }

        if (categoryId !== undefined) {
            where.categoryId = categoryId;
        }

        if (relatedSystemId !== undefined) {
            where.relatedSystemId = relatedSystemId;
        }

        if (requestedPriority !== undefined) {
            where.requestedPriority =
                requestedPriority as
                | "Low"
                | "Medium"
                | "High"
                | "Urgent";
        }

        if (currentStatus !== undefined) {
            where.currentStatus = "New";
        }

        let orderBy: Prisma.TicketOrderByWithRelationInput[];

        switch (sortBy) {
            case "oldest":
                orderBy = [
                    { createdAt: "asc" },
                    { ticketNumber: "asc" },
                ];
                break;

            case "recentlyUpdated":
                orderBy = [
                    { updatedAt: "desc" },
                    { ticketNumber: "asc" },
                ];
                break;

            case "ticketNumberAsc":
                orderBy = [
                    { ticketNumber: "asc" },
                    { createdAt: "desc" },
                ];
                break;

            case "newest":
            default:
                orderBy = [
                    { createdAt: "desc" },
                    { ticketNumber: "asc" },
                ];
                break;
        }

        const prisma = getPrisma();

        try {
            const [tickets, totalItems] =
                await prisma.$transaction([
                    prisma.ticket.findMany({
                        where,
                        select: {
                            id: true,
                            ticketNumber: true,
                            ticketDate: true,
                            currentStatus: true,
                            requestedPriority: true,
                            summary: true,
                            createdAt: true,
                            updatedAt: true,
                            category: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                            relatedSystem: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                        orderBy,
                        skip: (page - 1) * pageSize,
                        take: pageSize,
                    }),

                    prisma.ticket.count({
                        where,
                    }),
                ]);

            const totalPages =
                totalItems === 0
                    ? 0
                    : Math.ceil(totalItems / pageSize);

            return res.status(200).json({
                data: tickets.map((ticket) => ({
                    id: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    ticketDate: ticket.ticketDate,
                    currentStatus: ticket.currentStatus,
                    requestedPriority:
                        ticket.requestedPriority,
                    summary: ticket.summary,
                    category: ticket.category,
                    relatedSystem: ticket.relatedSystem,

                    // Feature-G attachments are not implemented yet.
                    activeAttachmentCount: 0,

                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                })),
                pagination: {
                    page,
                    pageSize,
                    totalItems,
                    totalPages,
                    hasNextPage:
                        totalPages > 0 && page < totalPages,
                    hasPreviousPage: page > 1,
                },
            });
        } catch {
            return res.status(500).json({
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to retrieve tickets.",
                    correlationId: randomUUID(),
                },
            });
        }
    }
);

// ---------------------------------------------------------------------------
// Feature-D — POST /api/v1/tickets
// ---------------------------------------------------------------------------
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

        const categoryIdError =
            validateCategoryId(categoryId);

        if (categoryIdError) {
            validationDetails.push(categoryIdError);
        }

        const relatedSystemIdError =
            validateRelatedSystemId(relatedSystemId);

        if (relatedSystemIdError) {
            validationDetails.push(
                relatedSystemIdError
            );
        }

        const summaryError =
            validateSummary(summary);

        if (summaryError) {
            validationDetails.push(summaryError);
        }

        const descriptionError =
            validateDescription(description);

        if (descriptionError) {
            validationDetails.push(
                descriptionError
            );
        }

        const clientRequestIdError =
            validateClientRequestId(
                clientRequestId
            );

        if (clientRequestIdError) {
            validationDetails.push(
                clientRequestIdError
            );
        }

        const priority =
            normalizePriority(requestedPriority);

        if (!priority) {
            validationDetails.push({
                field: "requestedPriority",
                message:
                    "Requested Priority must be Low, Medium, High, or Urgent.",
            });
        }

        if (
            validationDetails.length > 0 ||
            !priority
        ) {
            return sendValidationError(
                res,
                validationDetails
            );
        }

        const validPriority = priority;
        const prisma = getPrisma();

        try {
            const category =
                await prisma.category.findUnique({
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
                        message:
                            "The selected Category does not exist.",
                        correlationId: randomUUID(),
                    },
                });
            }

            if (!category.isActive) {
                return res.status(400).json({
                    error: {
                        code: "INACTIVE_CATEGORY",
                        message:
                            "The selected Category is inactive.",
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
                        message:
                            "The selected Related System does not exist.",
                        correlationId: randomUUID(),
                    },
                });
            }

            if (!relatedSystem.isActive) {
                return res.status(400).json({
                    error: {
                        code: "INACTIVE_RELATED_SYSTEM",
                        message:
                            "The selected Related System is inactive.",
                        correlationId: randomUUID(),
                    },
                });
            }

            const trimmedSummary =
                summary.trim();

            const trimmedDescription =
                description.trim();

            const existing =
                await prisma.ticket.findUnique({
                    where: {
                        requesterId_clientRequestId: {
                            requesterId: requester.id,
                            clientRequestId,
                        },
                    },
                });

            if (existing) {
                const exactReplay =
                    existing.categoryId ===
                    categoryId &&
                    existing.relatedSystemId ===
                    relatedSystemId &&
                    existing.requestedPriority ===
                    validPriority &&
                    existing.summary ===
                    trimmedSummary &&
                    existing.description ===
                    trimmedDescription;

                if (!exactReplay) {
                    return res.status(409).json({
                        error: {
                            code:
                                "IDEMPOTENCY_CONFLICT",
                            message:
                                "This clientRequestId was already used with different ticket data.",
                            correlationId:
                                randomUUID(),
                        },
                    });
                }

                res.setHeader(
                    "Idempotent-Replay",
                    "true"
                );

                return res.status(200).json({
                    data: {
                        id: existing.id,
                        ticketNumber:
                            existing.ticketNumber,
                        ticketDate:
                            existing.ticketDate,
                        currentStatus:
                            existing.currentStatus,
                        requestedPriority:
                            existing.requestedPriority,
                        summary: existing.summary,
                        description:
                            existing.description,
                        requesterId:
                            existing.requesterId,
                        categoryId:
                            existing.categoryId,
                        relatedSystemId:
                            existing.relatedSystemId,
                    },
                });
            }

            const now = new Date();
            const year = now.getUTCFullYear();

            const created =
                await prisma.$transaction(
                    async (tx) => {
                        const ticketNumber =
                            await generateTicketNumber(
                                tx,
                                year
                            );

                        return tx.ticket.create({
                            data: {
                                ticketNumber,
                                ticketDate: now,
                                currentStatus: "New",
                                requestedPriority:
                                    validPriority,
                                summary:
                                    trimmedSummary,
                                description:
                                    trimmedDescription,
                                clientRequestId,
                                requesterId:
                                    requester.id,
                                categoryId,
                                relatedSystemId,
                            },
                        });
                    }
                );

            return res.status(201).json({
                data: {
                    id: created.id,
                    ticketNumber:
                        created.ticketNumber,
                    ticketDate:
                        created.ticketDate,
                    currentStatus:
                        created.currentStatus,
                    requestedPriority:
                        created.requestedPriority,
                    summary: created.summary,
                    description:
                        created.description,
                    requesterId:
                        created.requesterId,
                    categoryId:
                        created.categoryId,
                    relatedSystemId:
                        created.relatedSystemId,
                },
            });
        } catch {
            return res.status(500).json({
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message:
                        "Failed to create ticket.",
                    correlationId: randomUUID(),
                },
            });
        }
    }
);