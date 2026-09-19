import { Router } from "express";
import { getPrisma } from "../prisma.js";
import { requireRequester } from "../middleware/requesterContext.js";
import { authError, authServerError } from "../services/authErrors.js";
export const requesterActionsRouter = Router();
const commentSelect = {
    id: true, ticketId: true, content: true, createdAt: true,
    author: { select: { id: true, name: true, role: true } },
} as const;
// Explicit public DTO: private staff communication is never queried or serialized.
requesterActionsRouter.use(requireRequester);
requesterActionsRouter.route("/:ticketId/comments")
    .get(async (req, res) => {
    try {
        const prisma = getPrisma();
        const ticket = await prisma.ticket.findFirst({ where: { id: req.params.ticketId, requesterId: req.auth!.user.id }, select: { id: true } });
        if (!ticket)
            return authError(res, 404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
        const comments = await prisma.publicComment.findMany({ where: { ticketId: ticket.id }, select: commentSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
        res.json({ data: comments });
    }
    catch {
        authServerError(res);
    }
})
    .post(async (req, res) => {
    try {
        const prisma = getPrisma();
        const ticket = await prisma.ticket.findFirst({ where: { id: req.params.ticketId, requesterId: req.auth!.user.id }, select: { id: true } });
        if (!ticket)
            return authError(res, 404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
        const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
        if (!content || content.length > 2000)
            return authError(res, 400, "VALIDATION_ERROR", "Comment must contain 1 to 2000 characters after trimming.");
        const comment = await prisma.publicComment.create({ data: { ticketId: ticket.id, authorId: req.auth!.user.id, content }, select: commentSelect });
        res.status(201).json({ data: comment });
    }
    catch {
        authServerError(res);
    }
});
requesterActionsRouter.post("/:ticketId/problem-appears-resolved", async (req, res) => {
    try {
        const prisma = getPrisma();
        const where = { id: req.params.ticketId, requesterId: req.auth!.user.id };
        const ticket = await prisma.ticket.findFirst({ where, select: { id: true } });
        if (!ticket)
            return authError(res, 404, "TICKET_NOT_FOUND", "The requested ticket was not found.");
        const problemAppearsResolvedAt = new Date();
        // Conditional write makes simultaneous indications conflict without changing status.
        const result = await prisma.ticket.updateMany({ where: { ...where, problemAppearsResolvedAt: null }, data: { problemAppearsResolvedAt } });
        if (!result.count)
            return authError(res, 409, "CONFLICT", "Problem Appears Resolved has already been recorded.");
        res.json({ data: { ticketId: ticket.id, problemAppearsResolvedAt } });
    }
    catch {
        authServerError(res);
    }
});
