import { Router } from "express";
import { Prisma, Role } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { authError, authServerError } from "../services/authErrors.js";
import { hashPassword, passwordValidationError } from "../services/passwords.js";

export const adminUsersRouter = Router();
const roles: Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
const select = { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true } as const;
const emailValid = (value: unknown) => typeof value === "string" && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const normalizedEmail = (value: string) => value.trim().toLowerCase();
const plainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const permitted = (body: Record<string, unknown>, fields: string[]) => Object.keys(body).every(key => fields.includes(key));
const validName = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const validRole = (value: unknown): value is Role => typeof value === "string" && roles.includes(value as Role);
const conflict = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
const invalid = (res: Parameters<typeof authError>[0]) => authError(res, 400, "VALIDATION_ERROR", "One or more fields are invalid.");

adminUsersRouter.get("/", async (req, res) => {
  const { search, role } = req.query;
  if ((search !== undefined && (typeof search !== "string" || search.length > 254)) ||
      (role !== undefined && !validRole(role))) return invalid(res);
  try {
    const term = typeof search === "string" ? search.trim() : "";
    const data = await getPrisma().user.findMany({
      where: { ...(role ? { role: role as Role } : {}), ...(term ? { OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ] } : {}) },
      select, orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return res.json({ data });
  } catch { return authServerError(res); }
});

adminUsersRouter.post("/", async (req, res) => {
  const body = req.body;
  if (!plainObject(body) || !permitted(body, ["name", "email", "role", "isActive", "initialPassword"]) ||
      !validName(body.name) || !emailValid(body.email) || !validRole(body.role) ||
      typeof body.isActive !== "boolean" || passwordValidationError(body.initialPassword)) return invalid(res);
  try {
    const data = await getPrisma().user.create({ data: {
      name: (body.name as string).trim(), email: normalizedEmail(body.email as string),
      role: body.role, isActive: body.isActive,
      passwordHash: await hashPassword(body.initialPassword as string), mustChangePassword: true,
    }, select });
    return res.status(201).json({ data });
  } catch (error) {
    if (conflict(error)) return authError(res, 409, "CONFLICT", "A user with this email already exists.");
    return authServerError(res);
  }
});

adminUsersRouter.patch("/:userId", async (req, res) => {
  const body = req.body;
  if (!plainObject(body) || !Object.keys(body).length || !permitted(body, ["name", "email", "role", "isActive"]) ||
      ("name" in body && !validName(body.name)) || ("email" in body && !emailValid(body.email)) ||
      ("role" in body && !validRole(body.role)) || ("isActive" in body && typeof body.isActive !== "boolean")) return invalid(res);
  try {
    const result = await getPrisma().$transaction(async tx => {
      // Serialize administrator safety checks across concurrent updates.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(33403)`;
      const target = await tx.user.findUnique({ where: { id: req.params.userId }, select: { id: true, role: true, isActive: true } });
      if (!target) return { kind: "missing" } as const;
      if (target.id === req.auth!.user.id && body.isActive === false) return { kind: "self" } as const;
      if (target.role === "ADMINISTRATOR" && target.isActive &&
          (body.role && body.role !== "ADMINISTRATOR" || body.isActive === false) &&
          await tx.user.count({ where: { role: "ADMINISTRATOR", isActive: true } }) <= 1) return { kind: "last" } as const;
      const data = await tx.user.update({ where: { id: target.id }, data: {
        ...(body.name !== undefined ? { name: (body.name as string).trim() } : {}),
        ...(body.email !== undefined ? { email: normalizedEmail(body.email as string) } : {}),
        ...(body.role !== undefined ? { role: body.role as Role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive as boolean } : {}),
      }, select });
      return { kind: "ok", data } as const;
    });
    if (result.kind === "missing") return authError(res, 404, "NOT_FOUND", "User not found.");
    if (result.kind === "self" || result.kind === "last") return authError(res, 409, "CONFLICT", result.kind === "self" ? "You cannot deactivate your own account." : "At least one active Administrator is required.");
    return res.json({ data: result.data });
  } catch (error) {
    if (conflict(error)) return authError(res, 409, "CONFLICT", "A user with this email already exists.");
    return authServerError(res);
  }
});

adminUsersRouter.post("/:userId/initial-password", async (req, res) => {
  const body = req.body;
  if (!plainObject(body) || !permitted(body, ["initialPassword"]) || passwordValidationError(body.initialPassword)) return invalid(res);
  try {
    if (req.params.userId === req.auth!.user.id) return authError(res, 403, "FORBIDDEN", "Set an initial password for another user.");
    const target = await getPrisma().user.findUnique({ where: { id: req.params.userId }, select: { id: true } });
    if (!target) return authError(res, 404, "NOT_FOUND", "User not found.");
    const passwordHash = await hashPassword(body.initialPassword as string);
    const data = await getPrisma().user.update({ where: { id: target.id }, data: { passwordHash, mustChangePassword: true }, select });
    return res.json({ data });
  } catch { return authServerError(res); }
});
