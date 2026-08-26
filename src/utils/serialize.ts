import { Role } from "../generated/prisma/client";

interface ArticleFull {
  code: string;
  name: string;
  category: string;
  motorcycleModel: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  supplier: string;
  barcode?: string | null;
  photo?: string | null;
}

export function serializeArticle(article: ArticleFull, role: Role) {
  if (role === "ADMIN") return article;
  const { purchasePrice, minStock, ...publicFields } = article;
  return publicFields;
}
