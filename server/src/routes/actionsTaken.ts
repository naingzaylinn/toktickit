import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { requireRoles } from "../middleware/requesterContext.js";
import { authError, authServerError } from "../services/authErrors.js";
import { ActionError, invalidAction, uuid, validateActionBody } from "../services/actionValidation.js";
import { createAction, listActions, patchAction, type ActionPage } from "../services/actionsTaken.js";

export const staffActionsTakenRouter = Router();
export const requesterActionsTakenRouter = Router();
staffActionsTakenRouter.use(requireRoles("IT_STAFF", "ADMINISTRATOR"));
requesterActionsTakenRouter.use("/:ticketId/actions", requireRoles("REQUESTER"));

function errorResponse(res: Response, error: unknown) {
  if (error instanceof ActionError) return authError(res, error.status, error.code, error.message, error.fields);
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2028"].includes(error.code)) return authError(res, 409, "CONFLICT", "The record changed. Reload and review before trying again.");
  return authServerError(res);
}
function validatePaths(req: Request) {
  const fields: Record<string, string> = {};
  for (const key of ["ticketId", "actionId"]) if (req.params[key] !== undefined && !uuid(req.params[key])) fields[key] = "Enter a UUID identifier.";
  if (Object.keys(fields).length) invalidAction(fields);
}
function validateQuery(req: Request, staff: boolean): ActionPage {
  const query = req.query;
  const allowed = staff ? ["page", "pageSize", "focusActionId"] : ["page", "pageSize"];
  const invalid = () => { throw new ActionError(400, "INVALID_QUERY_PARAMS", "Use page >= 1, pageSize 10, 20 or 50, and only supported single query values."); };
  if (Object.keys(query).some(key => !allowed.includes(key) || typeof query[key] !== "string")) invalid();
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
  if (query.page !== undefined && !/^[0-9]+$/.test(query.page as string) || !Number.isSafeInteger(page) || page < 1 || ![10, 20, 50].includes(pageSize) ||
      query.pageSize !== undefined && !/^[0-9]+$/.test(query.pageSize as string)) invalid();
  if (query.focusActionId !== undefined && (!uuid(query.focusActionId) || query.page !== undefined)) invalid();
  return { page, pageSize, ...(query.focusActionId ? { focusActionId: query.focusActionId as string } : {}) };
}
for (const [router, staff] of [[staffActionsTakenRouter, true], [requesterActionsTakenRouter, false]] as const) {
  router.get("/:ticketId/actions", async (req, res) => {
    try {
      validatePaths(req);
      res.json(await listActions(req.params.ticketId, validateQuery(req, staff), staff ? undefined : req.auth!.user.id));
    } catch (error) { errorResponse(res, error); }
  });
}
staffActionsTakenRouter.post("/:ticketId/actions", async (req, res) => {
  try {
    validatePaths(req);
    if (Object.keys(req.query).length) throw new ActionError(400, "INVALID_QUERY_PARAMS", "No query parameters are supported for action creation.");
    const body = validateActionBody(req.body, true);
    const { replay, ...response } = await createAction(req.params.ticketId, req.auth!.user.id, body);
    if (replay) res.setHeader("Idempotent-Replay", "true");
    res.status(replay ? 200 : 201).json(response);
  } catch (error) { errorResponse(res, error); }
});
staffActionsTakenRouter.patch("/:ticketId/actions/:actionId", async (req, res) => {
  try {
    validatePaths(req);
    if (Object.keys(req.query).length) throw new ActionError(400, "INVALID_QUERY_PARAMS", "No query parameters are supported for action edits.");
    const body = validateActionBody(req.body, false);
    res.json(await patchAction(req.params.ticketId, req.params.actionId, req.auth!.user.id, body));
  } catch (error) { errorResponse(res, error); }
});
