import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { signToken } from "../utils/jwt";
import { comparePassword } from "../utils/hashing";

export async function login(req: Request, res: Response) {
  const { codigo } = req.body;

  if (!codigo || typeof codigo !== "string") {
    return res.status(400).json({ error: "Codigo is required" });
  }

  const users = await prisma.user.findMany();
  for (const user of users) {
    if (await comparePassword(codigo, user.code)) {
      const token = signToken({ userId: user.id, role: user.role });
      return res.json({ token, role: user.role, username: user.username });
    }
  }

  return res.status(401).json({ error: "Invalid code" });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  return res.json({ role: user.role, username: user.username });
}
