import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { signToken } from "../utils/jwt";
import { comparePassword } from "../utils/hashing";

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  return res.json({ token, role: user.role, username: user.username });
}

export async function me(req: Request, res: Response) {
  return res.json({ role: req.user!.role, username: req.user!.username });
}
