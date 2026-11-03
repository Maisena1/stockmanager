import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { PaymentMethod } from "../generated/prisma/client";
import { computeBalance, startOfToday, parseLocalDate, endOfLocalDay } from "../utils/balance";

export async function today(_req: Request, res: Response) {
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: startOfToday() } },
  });
  return res.json(computeBalance(sales));
}

export async function range(req: Request, res: Response) {
  const { from, to, paymentMethod } = req.query;

  if (
    typeof paymentMethod === "string" &&
    paymentMethod &&
    !Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)
  ) {
    return res.status(400).json({
      error: "paymentMethod debe ser EFECTIVO, TARJETA o TRANSFERENCIA",
    });
  }

  const where: Record<string, unknown> = {};
  if (typeof paymentMethod === "string" && paymentMethod) {
    where.paymentMethod = paymentMethod;
  }
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