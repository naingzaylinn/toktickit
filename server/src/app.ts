import express, { Request, Response, ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { requireAuthentication, requirePasswordChanged } from "./middleware/authentication.js";
import { authError, authServerError } from "./services/authErrors.js";
import { getPrisma } from "./prisma.js";
import { requireRoles } from "./middleware/requesterContext.js";
import { requesterActionsRouter } from "./routes/requesterActions.js";
import { referenceDataRouter } from "./routes/referenceData.js";
import { ticketsRouter } from "./routes/tickets.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { staffTicketsRouter } from "./routes/staffTickets.js";
import { adminUsersRouter } from "./routes/adminUsers.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// Same-origin cookies only. Vite proxies /api in local development.
app.set("trust proxy", false);
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);


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
// Every normal API, including legacy aliases, crosses the same session boundary.
app.use("/api", requireAuthentication, requirePasswordChanged);
app.use(["/api/staff", "/api/v1/staff"], requireRoles("IT_STAFF", "ADMINISTRATOR"));
app.use(["/api/admin", "/api/v1/admin"], requireRoles("ADMINISTRATOR"));
app.use("/api/staff/tickets", staffTicketsRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/v1", referenceDataRouter);
for (const base of ["/api/tickets", "/api/v1/tickets"]) {
  app.use(base + "/:ticketId/attachments", attachmentsRouter);
  app.use(base, requesterActionsRouter);
  app.use(base, ticketsRouter);
}
app.use("/api", (_req, res) => authError(res, 404, "NOT_FOUND", "The requested resource was not found."));

const safeErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === "entity.parse.failed" || error?.type === "entity.too.large") {
    authError(res, 400, "VALIDATION_ERROR", "A valid JSON request body is required.");
  } else {
    authServerError(res);
  }
};
app.use(safeErrorHandler);

export default app;
