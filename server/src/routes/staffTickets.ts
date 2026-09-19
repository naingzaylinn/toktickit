import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma, RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";

export const staffTicketsRouter = Router();

const ALLOWED_PAGE_SIZES = [10, 20, 50] as const;

const ALLOWED_SORTS = [
    "ticketNumber",
    "createdAt",
    "updatedAt",
    "status",
    "requestedPriority",
    "itPriority",
] as const;

const ALLOWED_ORDERS = ["asc", "desc"] as const;

const PRIORITY_FROM_API: Record<string, RequestedPriority> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
};

const STATUS_FROM_API: Record<string, TicketStatus> = {
    NEW: "New",
    OPEN: "Open",
    IN_PROGRESS: "InProgress",
    WAITING_FOR_REQUESTER: "WaitingForRequester",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
    REOPENED: "Reopened",
    CANCELLED: "Cancelled",
};

const PRIORITY_TO_API: Record<RequestedPriority, string> = {
    Low: "LOW",
    Medium: "MEDIUM",
    High: "HIGH",
    Urgent: "URGENT",
};

const STATUS_TO_API: Record<TicketStatus, string> = {
    New: "NEW",
    Open: "OPEN",
    InProgress: "IN_PROGRESS",
    WaitingForRequester: "WAITING_FOR_REQUESTER",
    Resolved: "RESOLVED",
    Closed: "CLOSED",
    Reopened: "REOPENED",
    Cancelled: "CANCELLED",
};

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

function singleQueryValue(
    value: unknown
): string | undefined | null {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== "string") {
        return null;
    }

    return value;
}

staffTicketsRouter.get(
    "/",
    async (req: Request, res: Response) => {
        const searchRaw = singleQueryValue(req.query.search);
        const statusRaw = singleQueryValue(req.query.status);
        const requestedPriorityRaw =
            singleQueryValue(req.query.requestedPriority);
        const itPriorityRaw =
            singleQueryValue(req.query.itPriority);
        const ownerRaw = singleQueryValue(req.query.owner);
        const sortRaw = singleQueryValue(req.query.sort);
        const orderRaw = singleQueryValue(req.query.order);
        const pageRaw = singleQueryValue(req.query.page);
        const pageSizeRaw =
            singleQueryValue(req.query.pageSize);

        if (
            searchRaw === null ||
            statusRaw === null ||
            requestedPriorityRaw === null ||
            itPriorityRaw === null ||
            ownerRaw === null ||
            sortRaw === null ||
            orderRaw === null ||
            pageRaw === null ||
            pageSizeRaw === null
        ) {
            return sendQueryError(
                res,
                "Query parameters must contain a single value."
            );
        }

        const search = searchRaw?.trim() ?? "";
        const status = statusRaw?.trim();
        const requestedPriority =
            requestedPriorityRaw?.trim();
        const itPriority = itPriorityRaw?.trim();
        const owner = ownerRaw?.trim();
        const sort = sortRaw?.trim() || "updatedAt";
        const order = orderRaw?.trim() || "desc";

        const page =
            pageRaw === undefined
                ? 1
                : Number(pageRaw);

        const pageSize =
            pageSizeRaw === undefined
                ? 20
                : Number(pageSizeRaw);

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
                sort as (typeof ALLOWED_SORTS)[number]
            )
        ) {
            return sendQueryError(
                res,
                "Sort field is invalid."
            );
        }

        if (
            !ALLOWED_ORDERS.includes(
                order as (typeof ALLOWED_ORDERS)[number]
            )
        ) {
            return sendQueryError(
                res,
                "Sort order must be asc or desc."
            );
        }

        if (
    status !== undefined &&
    STATUS_FROM_API[status] === undefined
) {
    return sendQueryError(res, "Invalid status.");
}

if (
    requestedPriority !== undefined &&
    PRIORITY_FROM_API[requestedPriority] === undefined
) {
    return sendQueryError(res, "Invalid requestedPriority.");
}

if (
    itPriority !== undefined &&
    PRIORITY_FROM_API[itPriority] === undefined
) {
    return sendQueryError(res, "Invalid itPriority.");
}

        if (owner === "") {
            return sendQueryError(
                res,
                "Owner filter is invalid."
            );
        }

        const where: Prisma.TicketWhereInput = {};

        if (search) {
            where.OR = [
                {
                    ticketNumber: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    summary: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    requester: {
                        name: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                },
                {
                    requester: {
                        email: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                },
            ];
        }

        if (status !== undefined) {
    where.currentStatus = STATUS_FROM_API[status];
}

if (requestedPriority !== undefined) {
    where.requestedPriority =
        PRIORITY_FROM_API[requestedPriority];
}

if (itPriority !== undefined) {
    where.itPriority =
        PRIORITY_FROM_API[itPriority];
}

        if (owner === "assigned") {
            where.ownerId = {
                not: null,
            };
        } else if (owner === "unassigned") {
            where.ownerId = null;
        } else if (owner !== undefined) {
            where.ownerId = owner;
        }

        const direction =
            order as Prisma.SortOrder;

        let primaryOrder:
            Prisma.TicketOrderByWithRelationInput;

        switch (sort) {
            case "ticketNumber":
                primaryOrder = {
                    ticketNumber: direction,
                };
                break;

            case "createdAt":
                primaryOrder = {
                    createdAt: direction,
                };
                break;

            case "status":
                primaryOrder = {
                    currentStatus: direction,
                };
                break;

            case "requestedPriority":
                primaryOrder = {
                    requestedPriority: direction,
                };
                break;

            case "itPriority":
                primaryOrder = {
                    itPriority: direction,
                };
                break;

            case "updatedAt":
            default:
                primaryOrder = {
                    updatedAt: direction,
                };
                break;
        }

        /*
         * ticketNumber provides a deterministic tie-breaker so
         * pagination remains stable when multiple tickets have the
         * same value for the selected sort field.
         */
        const orderBy: Prisma.TicketOrderByWithRelationInput[] =
            sort === "ticketNumber"
                ? [primaryOrder]
                : [
                      primaryOrder,
                      { ticketNumber: "asc" },
                  ];

        const prisma = getPrisma();

        try {
            const [tickets, totalItems] =
                await prisma.$transaction([
                    prisma.ticket.findMany({
                        where,
                        select: {
                            id: true,
                            ticketNumber: true,
                            summary: true,

                            category: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },

                            requester: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },

                            requestedPriority: true,
                            itPriority: true,
                            currentStatus: true,

                            owner: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },

                            createdAt: true,
                            updatedAt: true,
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
                    summary: ticket.summary,
                    category: ticket.category,
                    requester: ticket.requester,
                    requestedPriority: PRIORITY_TO_API[ticket.requestedPriority],
itPriority: PRIORITY_TO_API[ticket.itPriority],
status: STATUS_TO_API[ticket.currentStatus],

                    owner: ticket.owner,
                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                })),

                meta: {
                    page,
                    pageSize,
                    totalItems,
                    totalPages,
                },
            });
        } catch {
            return res.status(500).json({
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message:
                        "Failed to retrieve the ticket queue.",
                    correlationId: randomUUID(),
                },
            });
        }
    }
);