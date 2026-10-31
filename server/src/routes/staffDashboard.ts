import { Router } from "express";
import { requireRoles } from "../middleware/requesterContext.js";
import { authError, authServerError } from "../services/authErrors.js";
import { staffDashboard } from "../services/staffDashboard.js";

export const staffDashboardRouter = Router();
staffDashboardRouter.use(requireRoles("IT_STAFF", "ADMINISTRATOR"));
staffDashboardRouter.get("/", async (req, res) => {
  // Inspect raw keys: Express may discard special keys from req.query.
  const queryStart = req.originalUrl.indexOf("?");
  const query = new URLSearchParams(queryStart === -1 ? "" : req.originalUrl.slice(queryStart));
  if (query.size) return authError(res, 400, "INVALID_QUERY_PARAMS", "No query parameters are supported.");
  try { res.json(await staffDashboard(req.auth!.user.id)); }
  catch { authServerError(res); }
});
