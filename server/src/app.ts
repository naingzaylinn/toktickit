import express, { Request, Response, ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { guardLegacySession } from "./middleware/authentication.js";
import { authError, authServerError } from "./services/authErrors.js";
import { getPrisma } from "./prisma.js";
import { developmentRequestersRouter } from "./routes/developmentRequesters.js";
import { referenceDataRouter } from "./routes/referenceData.js";
import { ticketsRouter } from "./routes/tickets.js";
import { attachmentsRouter } from "./routes/attachments.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// Same-origin cookies only. Vite proxies /api in local development.
app.set("trust proxy", false);
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);
app.use("/api", guardLegacySession);

// ---------------------------------------------------------------------------
// Issue 2 — API health check (Lab 1)
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list (Lab 1)
// Keep this endpoint unchanged for Lab 1 regression compatibility.
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch categories",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 Feature-A — Development Requester Context
// ---------------------------------------------------------------------------
app.use(
  "/api/v1/development-requesters",
  developmentRequestersRouter
);

// ---------------------------------------------------------------------------
// Lab 2 Feature-C — Ticket Reference Data
// Provides:
//   GET /api/v1/categories
//   GET /api/v1/related-systems
// ---------------------------------------------------------------------------
app.use("/api/v1", referenceDataRouter);

app.use(
  "/api/v1/tickets/:ticketId/attachments",
  attachmentsRouter
);

app.use("/api/v1/tickets", ticketsRouter);

const safeErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === "entity.parse.failed" || error?.type === "entity.too.large") {
    authError(res, 400, "VALIDATION_ERROR", "A valid JSON request body is required.");
  } else {
    authServerError(res);
  }
};
app.use(safeErrorHandler);

export default app;
