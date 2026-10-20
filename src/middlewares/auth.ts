import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { AuthPayload } from "../types/express";
import { validateAdminJti , clearAdminSession, getAdminSession } from "../lib/sessions";
import { prisma } from "../lib/prisma";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token not provided" });
  }

  const token = header.split(" ")[1];
  let payload: AuthPayload;
  try {
    payload = verifyToken(token) as AuthPayload;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { active: true, role: true },
    });
  } catch (err) {
    return next(err);
  }

  if (!user || !user.active) {
    return res.status(401).json({ error: "Usuario desactivado o inexistente" });
  }

  // El rol del token puede haber quedado viejo: manda el rol actual de la DB.
  if (user.role === "ADMIN") {
    if (!validateAdminJti(payload.jti)) {
      return res.status(401).json({ error: "Admin session expired or revoked" });
    }
    const session = getAdminSession();
    if (session && payload.userId !== session.userId) {
      clearAdminSession();
      return res.status(401).json({ error: "Admin session expired or revoked" });
    }
  }

  req.user = { ...payload, role: user.role };
  next();
}
