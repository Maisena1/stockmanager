import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { signToken } from "../utils/jwt";
import { comparePassword } from "../utils/hashing";
import { ensureAdminSession , clearAdminSession, touchAdminSession } from "../lib/sessions";


export async function login(req: Request, res: Response) {
  const { codigo } = req.body;

  if (!codigo || typeof codigo !== "string") {
    return res.status(400).json({ error: "Codigo is required" });
  }

  const users = await prisma.user.findMany();
  for (const user of users) {
    if (await comparePassword(codigo, user.code)) {
      if (user.role === "ADMIN") {
        const session = ensureAdminSession(user.id);
        if (!session.ok) {
          return res.status(409).json({ error : "Ya hay una sesión de administrador activa"});
        }
        const token = signToken({ userId: user.id, role: user.role, jti: session.session.jti });
        return res.json({ token, role: user.role, username: user.username });
      }
      const token = signToken({ userId: user.id, role: user.role});
      return res.json({ token, role: user.role, username:user.username});
    }
  }

  return res.status(401).json({ error: "Invalid code" });
}

export async function logout(req: Request, res: Response) {
 if (req.user?.role === "ADMIN") {
  clearAdminSession(req.user.jti);
 } 
 return res.json({ ok : true});
}

export async function heartbeat(req: Request, res: Response) {
  if (req.user?.role === "ADMIN") {
    touchAdminSession();
  } 
  return res.json({ ok : true});
}



export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  return res.json({ role: user.role, username: user.username });
}
