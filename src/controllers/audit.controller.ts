import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { parseAuditQuery } from "../lib/audit";

export async function listAudit(req: Request, res: Response) {
  const parsed = parseAuditQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }
  const { where, page, pageSize } = parsed.filters;

  if (where.userId !== undefined) {
    const user = await prisma.user.findUnique({ where: { id: where.userId } });
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
  }

  const [total, items] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, username: true, role: true } } },
    }),
  ]);

  return res.json({ items, total, page, pageSize });
}

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true },
    orderBy: { username: "asc" },
  });
  return res.json(users);
}
