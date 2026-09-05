import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../prisma.js";

// Extend express Request to optionally include requester
export interface Requester {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      requester?: Requester;
    }
  }
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireDevelopmentRequester(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requesterId = req.headers["x-development-requester-id"];

  // 1. Presence check
  if (!requesterId || (typeof requesterId === "string" && requesterId.trim() === "")) {
    res.status(400).json({
      error: {
        code: "MISSING_REQUESTER_HEADER",
        message: "Missing required X-Development-Requester-Id header.",
        correlationId: randomUUID(),
      },
    });
    return;
  }

  const idStr = Array.isArray(requesterId) ? requesterId[0] : requesterId;

  // 2. Format check (UUID string)
  if (!UUID_V4_REGEX.test(idStr)) {
    res.status(400).json({
      error: {
        code: "INVALID_REQUESTER_ID",
        message: "The X-Development-Requester-Id header must be a valid UUID.",
        correlationId: randomUUID(),
      },
    });
    return;
  }

  try {
    const prisma = getPrisma();
    const requester = await prisma.developmentRequester.findUnique({
      where: { id: idStr },
    });

    // 3. Database existence check
    if (!requester) {
      res.status(400).json({
        error: {
          code: "REQUESTER_NOT_FOUND",
          message: "The specified Development Requester does not exist.",
          correlationId: randomUUID(),
        },
      });
      return;
    }

    // 4. Active state check
    if (!requester.isActive) {
      res.status(400).json({
        error: {
          code: "INACTIVE_REQUESTER",
          message: "The specified Development Requester is inactive and cannot perform requester actions.",
          correlationId: randomUUID(),
        },
      });
      return;
    }

    // Successfully validated and active
    req.requester = requester;
    next();
  } catch (error) {
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An internal database error occurred while validating requester context.",
        correlationId: randomUUID(),
      },
    });
  }
}
