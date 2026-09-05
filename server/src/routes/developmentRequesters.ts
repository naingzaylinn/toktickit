import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../prisma.js";

export const developmentRequestersRouter = Router();

// GET /api/v1/development-requesters
// Retrieves the list of active Development Requesters for the frontend Development Requester Selection dropdown.
developmentRequestersRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesters = await prisma.developmentRequester.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: [
        { name: "asc" },
        { id: "asc" },
      ],
    });

    res.status(200).json({
      data: requesters,
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch development requesters.",
        correlationId: randomUUID(),
      },
    });
  }
});
