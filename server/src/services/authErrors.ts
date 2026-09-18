import type { Response } from "express";

export function authError(res: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  return res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
}

export const authenticationRequired = (res: Response) =>
  authError(res, 401, "AUTHENTICATION_REQUIRED", "A valid authenticated session is required.");
export const authenticationFailed = (res: Response) =>
  authError(res, 401, "INVALID_CREDENTIALS", "Unable to sign in with these credentials.");
export const authServerError = (res: Response) =>
  authError(res, 500, "INTERNAL_SERVER_ERROR", "Unable to complete the request.");
