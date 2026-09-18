import { Router } from "express";
import { getPrisma } from "../prisma.js";
import { requireAuthentication } from "../middleware/authentication.js";
import { authenticationFailed, authenticationRequired, authError, authServerError } from "../services/authErrors.js";
import { hashPassword, passwordValidationError, verifyPassword } from "../services/passwords.js";
import { login } from "../services/login.js";
import { clearSessionCookie, cookieOptions, readSessionToken, SESSION_COOKIE, SESSION_DURATION_MS } from "../services/sessions.js";

export const authRouter = Router();
authRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const fields: Record<string, string> = {};
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    fields.email = "A valid email address is required.";
  }
  if (typeof password !== "string" || password.length === 0) fields.password = "Password is required.";
  if (Object.keys(fields).length) return authError(res, 400, "VALIDATION_ERROR", "One or more fields are invalid.", fields);
  try {
    const result = await login(email.trim().toLowerCase(), password, req.ip ?? req.socket.remoteAddress ?? "unknown", readSessionToken(req));
    if (result.kind === "limited") {
      res.setHeader("Retry-After", result.retryAfter);
      return authError(res, 429, "TOO_MANY_LOGIN_ATTEMPTS", "Too many login attempts. Try again later.");
    }
    if (result.kind === "invalid") return authenticationFailed(res);
    res.cookie(SESSION_COOKIE, result.token, { ...cookieOptions(), maxAge: SESSION_DURATION_MS, expires: result.expiresAt });
    return res.json({ data: { user: result.user } });
  } catch {
    return authServerError(res);
  }
});

authRouter.get("/me", requireAuthentication, (req, res) => res.json({ data: req.auth!.user }));

authRouter.post("/logout", requireAuthentication, async (req, res) => {
  try {
    await getPrisma().session.deleteMany({ where: { id: req.auth!.sessionId } });
    clearSessionCookie(res);
    return res.json({ data: { message: "Logged out successfully." } });
  } catch {
    return authServerError(res);
  }
});

authRouter.post("/change-password", requireAuthentication, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
  const fields: Record<string, string> = {};
  if (typeof currentPassword !== "string" || !currentPassword) fields.currentPassword = "Current password is required.";
  const passwordError = passwordValidationError(newPassword);
  if (passwordError) fields.newPassword = passwordError;
  if (typeof confirmPassword !== "string" || confirmPassword !== newPassword) fields.confirmPassword = "Password confirmation must match.";
  if (Object.keys(fields).length) return authError(res, 400, "VALIDATION_ERROR", "One or more fields are invalid.", fields);
  try {
    const user = await getPrisma().user.findUnique({ where: { id: req.auth!.user.id } });
    if (!user?.isActive) return authenticationRequired(res);
    if (!await verifyPassword(currentPassword, user.passwordHash)) {
      return authError(res, 401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
    }
    const passwordHash = await hashPassword(newPassword);
    // Prevent concurrent changes from overwriting a password already replaced.
    const updated = await getPrisma().user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash, isActive: true },
      data: { passwordHash, mustChangePassword: false },
    });
    if (updated.count !== 1) return authenticationRequired(res);
    return res.json({ data: { message: "Password changed successfully." } });
  } catch {
    return authServerError(res);
  }
});
