import type { Request, Response, NextFunction } from "express";
import { getPrisma } from "../prisma.js";
import { authenticationRequired, authError, authServerError } from "../services/authErrors.js";
import { AuthenticatedUser, clearSessionCookie, readSessionToken, safeUser, sessionTokenHash } from "../services/sessions.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { user: AuthenticatedUser; sessionId: string };
    }
  }
}

export async function requireAuthentication(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const token = readSessionToken(req);
  if (!token) {
    clearSessionCookie(res);
    authenticationRequired(res);
    return;
  }
  try {
    const session = await getPrisma().session.findUnique({
      where: { token: sessionTokenHash(token) }, include: { user: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
      if (session) await getPrisma().session.deleteMany({ where: { id: session.id } });
      clearSessionCookie(res);
      authenticationRequired(res);
      return;
    }
    req.auth = { user: safeUser(session.user), sessionId: session.id };
    next();
  } catch {
    authServerError(res);
  }
}

export function requirePasswordChanged(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    authenticationRequired(res);
  } else if (req.auth.user.mustChangePassword) {
    authError(res, 403, "PASSWORD_CHANGE_REQUIRED", "Change your initial password before continuing.");
  } else {
    next();
  }
}
