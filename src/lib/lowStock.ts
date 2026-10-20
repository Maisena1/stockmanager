import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";

/**
 * Criterio único de stock bajo: stock <= stock mínimo.
 * Se comparte entre GET /api/articles?lowStock=true y
 * GET /api/sales/low-stock para no duplicar la regla.
 */
export function lowStockWhere(): Prisma.ArticleWhereInput {
  return { stock: { lte: prisma.article.fields.minStock } };
}
