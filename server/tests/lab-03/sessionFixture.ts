import { randomBytes } from "node:crypto";
import { getPrisma } from "../../src/prisma.js";
import { SESSION_COOKIE, sessionTokenHash } from "../../src/services/sessions.js";
// Database fixtures create real sessions; production middleware is never bypassed.
export async function requesterCookie(id: string) {
    const prisma = getPrisma();
    await prisma.user.update({ where: { id }, data: { mustChangePassword: false } });
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({ data: { userId: id, token: sessionTokenHash(token), expiresAt: new Date(Date.now() + 3600000) } });
    return SESSION_COOKIE + "=" + token;
}
