import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { AuthPayload } from "../types/express";
import { validateAdminJti , clearAdminSession, getAdminSession } from "../lib/sessions";

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token not provided" });
  }

  const token = header.split(" ")[1];
try {
    const payload = verifyToken(token) as AuthPayload;

    if (payload.role === "ADMIN") {
      if (!validateAdminJti(payload.jti)) {
        return res.status(401).json({ error: "Admin session expired or revoked" });
      }
      const session = getAdminSession();
      if (session && payload.userId !== session.userId) {
        clearAdminSession();
        return res.status(401).json({ error: "Admin session expired or revoked" });
      }
    }

    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
