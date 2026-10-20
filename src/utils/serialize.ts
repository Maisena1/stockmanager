import { Role } from "../generated/prisma/client";

interface ArticleSupplier {
  id: number;
  name: string;
}

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
  supplierId?: number | null;
  supplierName?: string | null;
  supplierInfo?: ArticleSupplier | null;
  barcode?: string | null;
  photo?: string | null;
}

export function serializeArticle(article: ArticleFull, role: Role) {
  const { supplierInfo, ...rest } = article;
  const withSupplier = supplierInfo
    ? {
        ...rest,
        supplierId: rest.supplierId ?? supplierInfo.id,
        supplierName: supplierInfo.name,
      }
    : rest;

  if (role === "ADMIN") return withSupplier;
  const { purchasePrice, minStock, ...publicFields } = withSupplier;
  return publicFields;
}
