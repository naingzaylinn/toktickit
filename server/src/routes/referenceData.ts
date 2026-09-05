import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../prisma.js";

export const referenceDataRouter = Router();

// GET /api/v1/categories
referenceDataRouter.get("/categories", async (_req: Request, res: Response) => {
    try {
        const prisma = getPrisma();

        const categories = await prisma.category.findMany({
            where: {
                isActive: true,
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: [
                { name: "asc" },
                { id: "asc" },
            ],
        });

        res.status(200).json({
            data: categories,
        });
    } catch {
        res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch categories.",
                correlationId: randomUUID(),
            },
        });
    }
});

// GET /api/v1/related-systems
referenceDataRouter.get(
    "/related-systems",
    async (_req: Request, res: Response) => {
        try {
            const prisma = getPrisma();

            const systems = await prisma.relatedSystem.findMany({
                where: {
                    isActive: true,
                },
                select: {
                    id: true,
                    name: true,
                },
                orderBy: [
                    { name: "asc" },
                    { id: "asc" },
                ],
            });

            res.status(200).json({
                data: systems,
            });
        } catch {
            res.status(500).json({
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch related systems.",
                    correlationId: randomUUID(),
                },
            });
        }
    }
);