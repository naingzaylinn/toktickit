import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma, RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { authError, authServerError } from "../services/authErrors.js";
import { readAttachmentBinary } from "../services/attachmentStorage.js";

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

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
    New: ["Open", "InProgress", "Cancelled"],
    Open: ["InProgress", "WaitingForRequester", "Resolved", "Cancelled"],
    InProgress: ["WaitingForRequester", "Resolved", "Cancelled"],
    WaitingForRequester: ["InProgress", "Resolved", "Cancelled"],
    Resolved: ["Closed", "Reopened"],
    Closed: ["Reopened"],
    Reopened: ["InProgress", "WaitingForRequester", "Resolved", "Cancelled"],
    Cancelled: ["Reopened"],
};

const messageSelect = { id: true, ticketId: true, content: true, createdAt: true,
    author: { select: { id: true, name: true, role: true } } } as const;

staffTicketsRouter.get("/owners", async (_req, res) => {
    try {
        const users = await getPrisma().user.findMany({ where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
        res.json({ data: users });
    } catch { authServerError(res); }
});

staffTicketsRouter.get("/:ticketId", async (req, res) => {
    try {
        const ticket = await getPrisma().ticket.findUnique({ where: { id: req.params.ticketId }, select: {
            id: true, ticketNumber: true, ticketDate: true, summary: true, description: true,
            requestedPriority: true, itPriority: true, currentStatus: true, problemAppearsResolvedAt: true,
            createdAt: true, updatedAt: true,
            requester: { select: { id: true, name: true, email: true } },
            owner: { select: { id: true, name: true, email: true } },
            category: { select: { id: true, name: true } }, relatedSystem: { select: { id: true, name: true } },
            attachments: { where: { isRemoved: false }, select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "asc" } },
            publicComments: { select: messageSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
            internalNotes: { select: messageSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        } });
        if (!ticket) return authError(res, 404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
        res.json({ data: { ...ticket, requestedPriority: PRIORITY_TO_API[ticket.requestedPriority], itPriority: PRIORITY_TO_API[ticket.itPriority], status: STATUS_TO_API[ticket.currentStatus], currentStatus: undefined } });
    } catch { authServerError(res); }
});

staffTicketsRouter.get("/:ticketId/attachments/:attachmentId/download", async (req, res) => {
    try {
        const attachment = await getPrisma().attachment.findFirst({ where: { id: req.params.attachmentId, ticketId: req.params.ticketId, isRemoved: false }, select: { originalFilename: true, mimeType: true, storageKey: true } });
        if (!attachment) return authError(res, 404, "ATTACHMENT_NOT_FOUND", "The requested attachment was not found.");
        const binary = await readAttachmentBinary(attachment.storageKey);
        res.setHeader("Content-Type", attachment.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${attachment.originalFilename.replace(/["\r\n]/g, "_")}"`);
        res.send(binary);
    } catch { authServerError(res); }
});

staffTicketsRouter.patch("/:ticketId/owner", async (req, res) => {
    try {
        if (!req.body || !Object.hasOwn(req.body, "ownerId") || (req.body.ownerId !== null && (typeof req.body.ownerId !== "string" || !req.body.ownerId.trim())))
            return authError(res, 400, "VALIDATION_ERROR", "A valid ownerId or null is required.");
        const prisma = getPrisma();
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.ticketId }, select: { id: true, ownerId: true } });
        if (!ticket) return authError(res, 404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
        const ownerId: string | null = req.body.ownerId;
        if (ownerId) {
            const owner = await prisma.user.findFirst({ where: { id: ownerId, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } }, select: { id: true } });
            if (!owner) return authError(res, 400, "VALIDATION_ERROR", "The selected owner is invalid.");
        }
        // Setting oneself as owner is a claim and requires an unassigned ticket.
        // The conditional write prevents concurrent claims from overwriting one another.
        if (ownerId === req.auth!.user.id && ticket.ownerId && ticket.ownerId !== ownerId)
            return authError(res, 409, "CONFLICT", "This ticket is already assigned.");
        const result = await prisma.ticket.updateMany({ where: { id: ticket.id, ...(ownerId === req.auth!.user.id ? { ownerId: ticket.ownerId } : {}) }, data: { ownerId } });
        if (!result.count) return authError(res, 409, "CONFLICT", "Ticket ownership changed. Reload and try again.");
        const updated = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { owner: { select: { id: true, name: true, email: true } }, updatedAt: true } });
        res.json({ data: updated });
    } catch { authServerError(res); }
});

staffTicketsRouter.patch("/:ticketId/priority", async (req, res) => {
    try {
        const raw = req.body?.itPriority;
        if (typeof raw !== "string" || !Object.hasOwn(PRIORITY_FROM_API, raw)) return authError(res, 400, "VALIDATION_ERROR", "Invalid IT Priority.");
        const prisma = getPrisma();
        const result = await prisma.ticket.updateMany({ where: { id: req.params.ticketId }, data: { itPriority: PRIORITY_FROM_API[raw] } });
        if (!result.count) return authError(res, 404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.ticketId }, select: { itPriority: true, requestedPriority: true, updatedAt: true } });
        res.json({ data: { itPriority: PRIORITY_TO_API[ticket!.itPriority], requestedPriority: PRIORITY_TO_API[ticket!.requestedPriority], updatedAt: ticket!.updatedAt } });
    } catch { authServerError(res); }
});

staffTicketsRouter.patch("/:ticketId/status", async (req, res) => {
    try {
        const raw = req.body?.status;
        if (typeof raw !== "string" || !Object.hasOwn(STATUS_FROM_API, raw)) return authError(res, 400, "VALIDATION_ERROR", "Invalid ticket status.");
        const prisma = getPrisma();
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.ticketId }, select: { currentStatus: true } });
        if (!ticket) return authError(res, 404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
        const next = STATUS_FROM_API[raw];
        if (!TRANSITIONS[ticket.currentStatus].includes(next)) return authError(res, 409, "CONFLICT", "This status transition is not permitted.");
        const result = await prisma.ticket.updateMany({ where: { id: req.params.ticketId, currentStatus: ticket.currentStatus }, data: { currentStatus: next } });
        if (!result.count) return authError(res, 409, "CONFLICT", "Ticket status changed. Reload and try again.");
        res.json({ data: { status: raw } });
    } catch { authServerError(res); }
});

staffTicketsRouter.route("/:ticketId/notes").get(async (req, res) => {
    try {
        const prisma = getPrisma();
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.ticketId }, select: { id: true } });
        if (!ticket) return authError(res, 404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
        const notes = await prisma.internalNote.findMany({ where: { ticketId: ticket.id }, select: messageSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
        res.json({ data: notes });
    } catch { authServerError(res); }
}).post(async (req, res) => {
    try {
        const prisma = getPrisma();
        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.ticketId }, select: { id: true } });
        if (!ticket) return authError(res, 404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
        const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
        if (!content || content.length > 2000) return authError(res, 400, "VALIDATION_ERROR", "Note must contain 1 to 2000 characters after trimming.");
        const note = await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: req.auth!.user.id, content }, select: messageSelect });
        res.status(201).json({ data: note });
    } catch { authServerError(res); }
});

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
