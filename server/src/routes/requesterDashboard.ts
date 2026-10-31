import { Router } from "express";
import { requireRequester } from "../middleware/requesterContext.js";
import { authError, authServerError } from "../services/authErrors.js";
import { requesterDashboard } from "../services/requesterDashboard.js";

export const requesterDashboardRouter = Router();
requesterDashboardRouter.use(requireRequester);
requesterDashboardRouter.get("/", async (req, res) => {
  // Express can discard special keys. Validate the original query instead.
  const start = req.originalUrl.indexOf("?");
  if (new URLSearchParams(start < 0 ? "" : req.originalUrl.slice(start)).size)
    return authError(res, 400, "INVALID_QUERY_PARAMS", "No query parameters are supported.");
  try { res.json(await requesterDashboard(req.auth!.user.id)); }
  catch { authServerError(res); }
});
