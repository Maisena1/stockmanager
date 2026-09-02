import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { PaymentMethod } from "../generated/prisma/client";

interface SaleItemInput {
  articleCode: string;
  quantity: number;
}

export async function createSale(req: Request, res: Response) {
  const { items, paymentMethod } = req.body;
  const userId = req.user!.userId;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  if (!paymentMethod || !Object.values(PaymentMethod).includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod is required: EFECTIVO, TARJETA or TRANSFERENCIA" });
  }
  const method = paymentMethod as PaymentMethod;

  const normalized: SaleItemInput[] = [];
  for (const item of items) {
    if (!item.articleCode || item.quantity == null) {
      return res.status(400).json({ error: "Each item needs articleCode and quantity" });
    }
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: "Quantity must be a positive number" });
    }
    normalized.push({ articleCode: item.articleCode.trim(), quantity: qty });
  }

  const codes = [...new Set(normalized.map((i) => i.articleCode))];
  const articles = await prisma.article.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(articles.map((a) => [a.code, a]));

  for (const i of normalized) {
    if (!byCode.has(i.articleCode)) {
      return res.status(404).json({ error: `Article not found: ${i.articleCode}` });
    }
  }

  const lines = normalized.map((i) => {
    const a = byCode.get(i.articleCode)!;
    return {
      articleCode: a.code,
      quantity: i.quantity,
      unitPrice: a.salePrice,
      total: i.quantity * a.salePrice,
    };
  });
  const total = lines.reduce((acc, l) => acc + l.total, 0);

  const warnings: string[] = [];
  for (const l of lines) {
    const a = byCode.get(l.articleCode)!;
    const remaining = a.stock - l.quantity;
    if (remaining < 0) {
      warnings.push(`${a.name}: insufficient stock (goes to ${remaining})`);
    }
  }

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        userId,
        total,
        paymentMethod: method,
        items: { create: lines },
      },
      include: { items: { include: { article: { select: { name: true } } } } },
    });

    for (const l of lines) {
      await tx.article.update({
        where: { code: l.articleCode },
        data: { stock: { decrement: l.quantity } },
      });
    }

    return created;
  });

  return res.status(201).json({
    sale,
    total,
    articlesCount: sale.items.length,
    ...(warnings.length ? { warnings } : {}),
  });
}

export async function listSales(_req: Request, res: Response) {
  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { username: true } },
      items: { include: { article: { select: { name: true } } } },
    },
  });
  return res.json(sales);
}

export async function lowStock(_req: Request, res: Response) {
  const articles = await prisma.article.findMany({
    where: { stock: { lte: prisma.article.fields.minStock } },
    orderBy: { supplier: "asc" },
  });

  const withShortage = articles.map((a) => ({
    ...a,
    shortage: Math.max(a.minStock - a.stock, 0),
  }));

  return res.json(withShortage);
}
