import type { RequestHandler } from "express";
import type { Role } from "@prisma/client";
import { authenticationRequired, authError } from "../services/authErrors.js";
export function requireRoles(...roles: Role[]): RequestHandler {
    return (req, res, next) => {
        if (!req.auth)
            return authenticationRequired(res);
        if (!roles.includes(req.auth.user.role))
            return authError(res, 403, "FORBIDDEN", "You are not permitted to perform this operation.");
        next();
    };
}
export const requireRequester = requireRoles("REQUESTER");
