import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { serializeArticle } from "../utils/serialize";
import { calculateSalePrice } from "../utils/precio";
import { generateCode } from "../utils/codigo";

export async function list(req: Request, res: Response) {
  const { q, name, category, model } = req.query;
  const role = req.user!.role;

  const where: Record<string, unknown> = {};
  if (typeof q === "string" && q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { motorcycleModel: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
    ];
  }
  if (typeof name === "string" && name) where.name = { contains: name, mode: "insensitive" };
  if (typeof category === "string" && category) where.category = { contains: category, mode: "insensitive" };
  if (typeof model === "string" && model) where.motorcycleModel = { contains: model, mode: "insensitive" };

  const articles = await prisma.article.findMany({ where });
  return res.json(articles.map((a) => serializeArticle(a, role)));
}

export async function getOne(req: Request, res: Response) {
  const code = String(req.params.code);
  const role = req.user!.role;

  const article = await prisma.article.findUnique({ where: { code } });
  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }
  return res.json(serializeArticle(article, role));
}

export async function create(req: Request, res: Response) {
  const data = req.body;

  if (
    !data.name || !data.category || !data.motorcycleModel ||
    data.purchasePrice == null || data.percentage == null ||
    data.stock == null || data.minStock == null || !data.supplier
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const purchasePrice = Number(data.purchasePrice);
  const percentage = Number(data.percentage);
  const salePrice = calculateSalePrice(purchasePrice, percentage);
  const code = await generateCode(data.name);

  const article = await prisma.article.create({
    data: {
      code,
      name: data.name,
      category: data.category,
      motorcycleModel: data.motorcycleModel,
      purchasePrice,
      salePrice,
      stock: Number(data.stock),
      minStock: Number(data.minStock),
      supplier: data.supplier,
      barcode: data.barcode || null,
    },
  });

  return res.status(201).json(article);
}

export async function update(req: Request, res: Response) {
  const code = String(req.params.code);
  const data = req.body;

  const existing = await prisma.article.findUnique({ where: { code } });
  if (!existing) {
    return res.status(404).json({ error: "Article not found" });
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.motorcycleModel !== undefined) updateData.motorcycleModel = data.motorcycleModel;
  if (data.stock !== undefined) updateData.stock = Number(data.stock);
  if (data.minStock !== undefined) updateData.minStock = Number(data.minStock);
  if (data.supplier !== undefined) updateData.supplier = data.supplier;
  if (data.barcode !== undefined) updateData.barcode = data.barcode || null;

  if (data.purchasePrice !== undefined) updateData.purchasePrice = Number(data.purchasePrice);
  if (data.percentage !== undefined || data.purchasePrice !== undefined) {
    const price = data.purchasePrice !== undefined ? Number(data.purchasePrice) : existing.purchasePrice;
    const pct = data.percentage !== undefined ? Number(data.percentage) : undefined;
    if (pct !== undefined && Number.isFinite(pct)) {
      updateData.salePrice = calculateSalePrice(price, pct);
    } else if (data.purchasePrice !== undefined) {
      const currentMargin = existing.salePrice / existing.purchasePrice - 1;
      updateData.salePrice = calculateSalePrice(price, currentMargin * 100);
    }
  }

  const article = await prisma.article.update({ where: { code }, data: updateData });
  return res.json(article);
}

export async function remove(req: Request, res: Response) {
  const code = String(req.params.code);

  const existing = await prisma.article.findUnique({ where: { code } });
  if (!existing) {
    return res.status(404).json({ error: "Article not found" });
  }

  await prisma.article.delete({ where: { code } });
  return res.status(204).send();
}
