import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { computeBalance, startOfToday, parseLocalDate, endOfLocalDay } from "../utils/balance";

export async function today(_req: Request, res: Response) {
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: startOfToday() } },
  });
  return res.json(computeBalance(sales));
}

export async function range(req: Request, res: Response) {
  const { from, to } = req.query;

  const where: Record<string, unknown> = {};
  if (typeof from === "string" && from) {
    const parsed = parseLocalDate(from);
    if (parsed) where.createdAt = { gte: parsed };
  }
  if (typeof to === "string" && to) {
    const parsed = parseLocalDate(to);
    if (parsed) {
      where.createdAt = { ...(where.createdAt as object), lte: endOfLocalDay(parsed) };
    }
  }

  const sales = await prisma.sale.findMany({ where });
  return res.json(computeBalance(sales));
}