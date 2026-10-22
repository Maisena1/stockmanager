import { Request, Response } from "express";
import { PaymentMethod, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { lowStockWhere } from "../lib/lowStock";
import { firstString } from "../utils/query";
import { parsePositiveId } from "../utils/proveedores";
import {
  type CompareMode,
  type ReportPagination,
  type ReportPeriod,
  MONTH_NAMES,
  dateKey,
  paginate,
  parseCompareMode,
  parseReportPagination,
  previousReportPeriod,
  resolveReportPeriod,
  roundMoney,
  serializePeriod,
} from "../utils/reports";
import { serializeArticle } from "../utils/serialize";

interface CommonFilters {
  period: ReportPeriod;
  previousPeriod: ReportPeriod | null;
  compareWith: CompareMode;
  pagination: ReportPagination;
}

type OptionalId = { ok: true; id?: number } | { ok: false; error: string };

function optionalPositiveId(value: unknown, label: string): OptionalId {
  const raw = firstString(value);
  if (raw === undefined || raw === "") return { ok: true };
  const id = parsePositiveId(raw);
  if (id === null) {
    return { ok: false, error: `El filtro ${label} debe ser un número entero positivo` };
  }
  return { ok: true, id };
}

function optionalNumber(
  value: unknown,
  label: string,
): { ok: true; value?: number } | { ok: false; error: string } {
  const raw = firstString(value);
  if (raw === undefined || raw === "") return { ok: true };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: `El filtro ${label} debe ser un número` };
  }
  return { ok: true, value: parsed };
}

function optionalBoolean(
  value: unknown,
  label: string,
): { ok: true; value?: boolean } | { ok: false; error: string } {
  const raw = firstString(value);
  if (raw === undefined || raw === "") return { ok: true };
  if (raw === "true") return { ok: true, value: true };
  if (raw === "false") return { ok: true, value: false };
  return { ok: false, error: `El filtro ${label} debe ser true o false` };
}

function commonFilters(req: Request, res: Response): CommonFilters | null {
  const resolved = resolveReportPeriod(req.query as Record<string, unknown>);
  if (!resolved.ok) {
    res.status(400).json({ error: resolved.error });
    return null;
  }

  const compareWith = parseCompareMode(req.query.compareWith);
  if (compareWith === null) {
    res.status(400).json({
      error: "El valor de compareWith no es válido (previous, previousMonth o none)",
    });
    return null;
  }

  return {
    period: resolved.period,
    previousPeriod: previousReportPeriod(resolved.period, compareWith),
    compareWith,
    pagination: parseReportPagination(req.query as Record<string, unknown>),
  };
}

function reportEnvelope(
  common: CommonFilters,
  summary: unknown,
  rows: unknown[],
  groups: unknown,
  previous?: { summary: unknown; rows: unknown[] } | null,
) {
  return {
    period: serializePeriod(common.period),
    previousPeriod: common.previousPeriod ? serializePeriod(common.previousPeriod) : null,
    compareWith: common.compareWith,
    summary,
    rows,
    groups,
    previous: previous
      ? {
          period: common.previousPeriod ? serializePeriod(common.previousPeriod) : null,
          summary: previous.summary,
          rows: previous.rows,
        }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Ventas                                                              */
/* ------------------------------------------------------------------ */

interface SalesRow {
  id: number;
  date: string;
  sellerId: number;
  seller: string;
  itemCount: number;
  units: number;
  total: number;
  paymentMethod: PaymentMethod;
}

interface SalesSummary {
  total: number;
  count: number;
  avgTicket: number;
  units: number;
}

async function loadSalesRows(
  period: ReportPeriod,
  where: Prisma.SaleWhereInput,
): Promise<SalesRow[]> {
  const sales = await prisma.sale.findMany({
    where: { ...where, createdAt: { gte: period.from, lte: period.to } },
    include: {
      user: { select: { id: true, username: true } },
      items: { select: { quantity: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return sales.map((sale) => ({
    id: sale.id,
    date: sale.createdAt.toISOString(),
    sellerId: sale.user.id,
    seller: sale.user.username,
    itemCount: sale.items.length,
    units: sale.items.reduce((sum, item) => sum + item.quantity, 0),
    total: roundMoney(sale.total),
    paymentMethod: sale.paymentMethod,
  }));
}

function summarizeSales(rows: SalesRow[]): SalesSummary {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    total: roundMoney(total),
    count: rows.length,
    avgTicket: rows.length ? roundMoney(total / rows.length) : 0,
    units: rows.reduce((sum, row) => sum + row.units, 0),
  };
}

function groupSales(rows: SalesRow[]) {
  const byDay = new Map<string, { date: string; total: number; count: number; units: number }>();
  const bySeller = new Map<
    number,
    { userId: number; seller: string; total: number; count: number; units: number }
  >();

  for (const row of rows) {
    const day = dateKey(new Date(row.date));
    const dayEntry = byDay.get(day) ?? { date: day, total: 0, count: 0, units: 0 };
    dayEntry.total += row.total;
    dayEntry.count += 1;
    dayEntry.units += row.units;
    byDay.set(day, dayEntry);

    const sellerEntry = bySeller.get(row.sellerId) ?? {
      userId: row.sellerId,
      seller: row.seller,
      total: 0,
      count: 0,
      units: 0,
    };
    sellerEntry.total += row.total;
    sellerEntry.count += 1;
    sellerEntry.units += row.units;
    bySeller.set(row.sellerId, sellerEntry);
  }

  return {
    byDay: [...byDay.values()]
      .map((entry) => ({ ...entry, total: roundMoney(entry.total) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    bySeller: [...bySeller.values()]
      .map((entry) => ({ ...entry, total: roundMoney(entry.total) }))
      .sort((a, b) => b.total - a.total),
  };
}

function salesWhere(req: Request, res: Response): Prisma.SaleWhereInput | null {
  const where: Prisma.SaleWhereInput = {};

  const userId = optionalPositiveId(req.query.userId, "vendedor");
  if (!userId.ok) {
    res.status(400).json({ error: userId.error });
    return null;
  }
  if (userId.id !== undefined) where.userId = userId.id;

  const paymentMethod = firstString(req.query.paymentMethod);
  if (paymentMethod !== undefined && paymentMethod !== "") {
    if (!Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
      res.status(400).json({
        error: "El tipo de pago debe ser EFECTIVO, TARJETA o TRANSFERENCIA",
      });
      return null;
    }
    where.paymentMethod = paymentMethod as PaymentMethod;
  }

  const minTotal = optionalNumber(req.query.minTotal, "minTotal");
  if (!minTotal.ok) {
    res.status(400).json({ error: minTotal.error });
    return null;
  }
  const maxTotal = optionalNumber(req.query.maxTotal, "maxTotal");
  if (!maxTotal.ok) {
    res.status(400).json({ error: maxTotal.error });
    return null;
  }
  if (
    minTotal.value !== undefined &&
    maxTotal.value !== undefined &&
    minTotal.value > maxTotal.value
  ) {
    res.status(400).json({ error: "El total mínimo no puede ser mayor que el máximo" });
    return null;
  }

  const total: Prisma.FloatFilter = {};
  if (minTotal.value !== undefined) total.gte = minTotal.value;
  if (maxTotal.value !== undefined) total.lte = maxTotal.value;
  if (Object.keys(total).length > 0) where.total = total;

  return where;
}

export async function salesReport(req: Request, res: Response) {
  const common = commonFilters(req, res);
  if (!common) return;

  const where = salesWhere(req, res);
  if (!where) return;

  const allRows = await loadSalesRows(common.period, where);
  const page = paginate(allRows, common.pagination);

  let previous: { summary: SalesSummary; rows: SalesRow[] } | null = null;
  if (common.previousPeriod) {
    const previousRows = await loadSalesRows(common.previousPeriod, where);
    previous = {
      summary: summarizeSales(previousRows),
      rows: paginate(previousRows, common.pagination).rows,
    };
  }

  return res.json({
    ...reportEnvelope(common, summarizeSales(allRows), page.rows, groupSales(allRows), previous),
    pagination: page.info,
  });
}

/* ------------------------------------------------------------------ */
/* Productos más vendidos                                              */
/* ------------------------------------------------------------------ */

interface ProductRow {
  code: string | null;
  name: string;
  category: string;
  motorcycleModel: string;
  supplierId: number | null;
  supplierName: string | null;
  stock: number;
  minStock?: number;
  purchasePrice?: number;
  salePrice: number;
  units: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  deleted?: boolean;
}

interface ProductSummary {
  units: number;
  revenue: number;
  margin: number;
  products: number;
}

type ProductSort = "units" | "revenue" | "margin";

function parseProductSort(value: unknown): ProductSort {
  const raw = firstString(value);
  if (raw === "revenue" || raw === "margin" || raw === "units") return raw;
  return "units";
}

function productSummary(rows: ProductRow[]): ProductSummary {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const margin = rows.reduce((sum, row) => sum + row.margin, 0);
  return {
    units: rows.reduce((sum, row) => sum + row.units, 0),
    revenue: roundMoney(revenue),
    margin: roundMoney(margin),
    products: rows.filter((row) => row.units > 0).length,
  };
}

function productRows(
  articles: Array<{
    code: string;
    name: string;
    category: string;
    motorcycleModel: string;
    purchasePrice: number;
    salePrice: number;
    stock: number;
    minStock: number;
    supplierId: number | null;
    supplierInfo: { id: number; name: string } | null;
  }>,
  soldItems: Array<{
    articleCode: string | null;
    articleName: string;
    quantity: number;
    unitPrice: number;
    purchasePrice: number;
  }>,
  options: {
    onlyWithSales: boolean;
    hasArticleFilters: boolean;
    sortBy: ProductSort;
    role: "ADMIN" | "EMPLOYEE";
  },
): ProductRow[] {
  const articleByCode = new Map(articles.map((article) => [article.code, article]));
  const aggregated = new Map<
    string,
    { code: string | null; name: string; units: number; revenue: number; cost: number }
  >();

  for (const item of soldItems) {
    let code: string | null = null;

    if (item.articleCode) {
      const article = articleByCode.get(item.articleCode);
      if (article) {
        code = article.code;
      } else if (options.hasArticleFilters) {
        // El artículo no pasó los filtros (o ya no existe y hay filtros
        // activos): no corresponde mostrarlo en este reporte.
        continue;
      }
    } else if (options.hasArticleFilters) {
      continue;
    }

    const key = code ? `code:${code}` : `name:${item.articleName}`;
    const entry = aggregated.get(key) ?? {
      code,
      name: item.articleName,
      units: 0,
      revenue: 0,
      cost: 0,
    };
    entry.units += item.quantity;
    entry.revenue += item.unitPrice * item.quantity;
    entry.cost += item.purchasePrice * item.quantity;
    aggregated.set(key, entry);
  }

  const rows: ProductRow[] = [];

  for (const entry of aggregated.values()) {
    const article = entry.code ? articleByCode.get(entry.code) : undefined;
    if (article) {
      const serialized = serializeArticle(article, options.role);
      const margin = entry.revenue - entry.cost;
      rows.push({
        ...serialized,
        supplierId: serialized.supplierId ?? null,
        supplierName: serialized.supplierName ?? null,
        units: entry.units,
        revenue: roundMoney(entry.revenue),
        cost: roundMoney(entry.cost),
        margin: roundMoney(margin),
        marginPct: entry.revenue > 0 ? roundMoney((margin / entry.revenue) * 100) : 0,
      });
    } else {
      const margin = entry.revenue - entry.cost;
      rows.push({
        code: null,
        name: entry.name,
        category: "—",
        motorcycleModel: "—",
        supplierId: null,
        supplierName: null,
        stock: 0,
        salePrice: 0,
        units: entry.units,
        revenue: roundMoney(entry.revenue),
        cost: roundMoney(entry.cost),
        margin: roundMoney(margin),
        marginPct: entry.revenue > 0 ? roundMoney((margin / entry.revenue) * 100) : 0,
        deleted: true,
      });
    }
  }

  if (!options.onlyWithSales) {
    const soldCodes = new Set(
      [...aggregated.values()]
        .map((entry) => entry.code)
        .filter((code): code is string => code !== null),
    );

    for (const article of articles) {
      if (soldCodes.has(article.code)) continue;
      const serialized = serializeArticle(article, options.role);
      rows.push({
        ...serialized,
        supplierId: serialized.supplierId ?? null,
        supplierName: serialized.supplierName ?? null,
        units: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        marginPct: 0,
      });
    }
  }

  const metric = (row: ProductRow) =>
    options.sortBy === "revenue"
      ? row.revenue
      : options.sortBy === "margin"
        ? row.margin
        : row.units;

  rows.sort(
    (a, b) =>
      metric(b) - metric(a) ||
      b.revenue - a.revenue ||
      a.name.localeCompare(b.name, "es"),
  );

  return rows;
}

function groupProducts(rows: ProductRow[]) {
  const byCategory = new Map<
    string,
    { category: string; units: number; revenue: number; margin: number; products: number }
  >();

  for (const row of rows) {
    const key = row.category || "Sin categoría";
    const entry = byCategory.get(key) ?? {
      category: key,
      units: 0,
      revenue: 0,
      margin: 0,
      products: 0,
    };
    entry.units += row.units;
    entry.revenue += row.revenue;
    entry.margin += row.margin;
    entry.products += 1;
    byCategory.set(key, entry);
  }

  return {
    byCategory: [...byCategory.values()]
      .map((entry) => ({
        ...entry,
        revenue: roundMoney(entry.revenue),
        margin: roundMoney(entry.margin),
      }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

async function loadSoldItems(period: ReportPeriod) {
  return prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: period.from, lte: period.to } } },
    select: {
      articleCode: true,
      articleName: true,
      quantity: true,
      unitPrice: true,
      purchasePrice: true,
    },
  });
}

export async function topProductsReport(req: Request, res: Response) {
  const common = commonFilters(req, res);
  if (!common) return;

  const supplier = optionalPositiveId(req.query.supplierId, "proveedor");
  if (!supplier.ok) {
    res.status(400).json({ error: supplier.error });
    return;
  }

  const onlyWithSales = optionalBoolean(req.query.onlyWithSales, "onlyWithSales");
  if (!onlyWithSales.ok) {
    res.status(400).json({ error: onlyWithSales.error });
    return;
  }

  const category = firstString(req.query.category)?.trim();
  const motorcycleModel = firstString(req.query.motorcycleModel)?.trim();
  const hasArticleFilters = Boolean(supplier.id || category || motorcycleModel);

  const articleWhere: Prisma.ArticleWhereInput = {};
  if (supplier.id !== undefined) articleWhere.supplierId = supplier.id;
  if (category) articleWhere.category = { contains: category, mode: "insensitive" };
  if (motorcycleModel) {
    articleWhere.motorcycleModel = { contains: motorcycleModel, mode: "insensitive" };
  }

  const articles = await prisma.article.findMany({
    where: articleWhere,
    include: { supplierInfo: true },
  });

  const options = {
    onlyWithSales: onlyWithSales.value ?? true,
    hasArticleFilters,
    sortBy: parseProductSort(req.query.sortBy),
    role: req.user!.role,
  } as const;

  const currentItems = await loadSoldItems(common.period);
  const allRows = productRows(articles, currentItems, options);
  const page = paginate(allRows, common.pagination);

  let previous: { summary: ProductSummary; rows: ProductRow[] } | null = null;
  if (common.previousPeriod) {
    const previousItems = await loadSoldItems(common.previousPeriod);
    const previousRows = productRows(articles, previousItems, options);
    previous = {
      summary: productSummary(previousRows),
      rows: paginate(previousRows, common.pagination).rows,
    };
  }

  return res.json({
    ...reportEnvelope(
      common,
      productSummary(allRows),
      page.rows,
      groupProducts(allRows),
      previous,
    ),
    pagination: page.info,
    sortBy: options.sortBy,
  });
}

/* ------------------------------------------------------------------ */
/* Bajo stock                                                          */
/* ------------------------------------------------------------------ */

type Criticality = "low" | "critical" | "out";

interface LowStockRow {
  code: string;
  name: string;
  category: string;
  motorcycleModel: string;
  supplierId: number | null;
  supplierName: string | null;
  stock: number;
  minStock: number;
  purchasePrice?: number;
  stockValue: number;
  shortage: number;
  suggestedOrder: number;
  criticality: Criticality;
}

function criticalityOf(stock: number, minStock: number): Criticality {
  if (stock <= 0) return "out";
  if (stock <= Math.ceil(minStock / 2)) return "critical";
  return "low";
}

function lowStockSummary(rows: LowStockRow[]) {
  return {
    articles: rows.length,
    low: rows.filter((row) => row.criticality === "low").length,
    critical: rows.filter((row) => row.criticality === "critical").length,
    out: rows.filter((row) => row.criticality === "out").length,
    stockValue: roundMoney(rows.reduce((sum, row) => sum + row.stockValue, 0)),
    suggestedUnits: rows.reduce((sum, row) => sum + row.suggestedOrder, 0),
  };
}

function groupLowStock(rows: LowStockRow[]) {
  const bySupplier = new Map<
    number,
    {
      supplierId: number | null;
      supplierName: string;
      articles: number;
      critical: number;
      out: number;
      stockValue: number;
      suggestedOrder: number;
    }
  >();

  for (const row of rows) {
    const key = row.supplierId ?? 0;
    const entry = bySupplier.get(key) ?? {
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? "Sin proveedor",
      articles: 0,
      critical: 0,
      out: 0,
      stockValue: 0,
      suggestedOrder: 0,
    };
    entry.articles += 1;
    if (row.criticality === "critical") entry.critical += 1;
    if (row.criticality === "out") entry.out += 1;
    entry.stockValue += row.stockValue;
    entry.suggestedOrder += row.suggestedOrder;
    bySupplier.set(key, entry);
  }

  return {
    bySupplier: [...bySupplier.values()]
      .map((entry) => ({ ...entry, stockValue: roundMoney(entry.stockValue) }))
      .sort((a, b) => a.supplierName.localeCompare(b.supplierName, "es")),
  };
}

export async function lowStockReport(req: Request, res: Response) {
  const common = commonFilters(req, res);
  if (!common) return;

  const supplier = optionalPositiveId(req.query.supplierId, "proveedor");
  if (!supplier.ok) {
    res.status(400).json({ error: supplier.error });
    return;
  }

  const includeZeroStock = optionalBoolean(req.query.includeZeroStock, "includeZeroStock");
  if (!includeZeroStock.ok) {
    res.status(400).json({ error: includeZeroStock.error });
    return;
  }

  const criticalityRaw = firstString(req.query.criticality);
  if (
    criticalityRaw !== undefined &&
    criticalityRaw !== "" &&
    !["low", "critical", "out"].includes(criticalityRaw)
  ) {
    res.status(400).json({
      error: "La criticidad debe ser low, critical u out",
    });
    return;
  }

  const category = firstString(req.query.category)?.trim();

  const where: Prisma.ArticleWhereInput = { ...lowStockWhere() };
  if (supplier.id !== undefined) where.supplierId = supplier.id;
  if (category) where.category = { contains: category, mode: "insensitive" };
  if (includeZeroStock.value === false) {
    where.stock = { ...(where.stock as object), gt: 0 };
  }

  const articles = await prisma.article.findMany({
    where,
    include: { supplierInfo: true },
    orderBy: [{ supplierInfo: { name: "asc" } }, { name: "asc" }],
  });

  const candidates =
    includeZeroStock.value === false
      ? articles.filter((article) => article.stock > 0)
      : articles;

  const rows: LowStockRow[] = candidates.map((article) => {
    const serialized = serializeArticle(article, req.user!.role);
    const minStock = article.minStock;
    const stock = article.stock;
    // RNF-22: el costo solo se expone al admin. Las rutas ya exigen ADMIN,
    // pero la serialización se mantiene explícita por rol.
    const purchasePrice = req.user!.role === "ADMIN" ? article.purchasePrice : undefined;
    return {
      ...serialized,
      supplierId: serialized.supplierId ?? null,
      supplierName: serialized.supplierName ?? null,
      purchasePrice,
      minStock,
      stockValue: roundMoney((purchasePrice ?? 0) * stock),
      shortage: Math.max(minStock - stock, 0),
      // Reposición sugerida: llevar el stock al doble del mínimo, que es el
      // criterio simple de punto de pedido que usa el negocio.
      suggestedOrder: Math.max(minStock * 2 - stock, 0),
      criticality: criticalityOf(stock, minStock),
    };
  });

  const filtered = criticalityRaw
    ? rows.filter((row) => row.criticality === criticalityRaw)
    : rows;

  const page = paginate(filtered, common.pagination);

  return res.json({
    ...reportEnvelope(common, lowStockSummary(filtered), page.rows, groupLowStock(filtered), null),
    previous: null,
    previousPeriod: null,
    compareWith: "none",
    pagination: page.info,
  });
}

/* ------------------------------------------------------------------ */
/* Compras por proveedor                                               */
/* ------------------------------------------------------------------ */

type PurchaseSort = "cost" | "articles" | "stockValue";

interface PurchaseRow {
  supplierId: number | null;
  supplierName: string;
  articles: number;
  purchasedArticles: number;
  cost: number;
  stockValue: number;
  idleStockValue: number;
  soldUnits: number;
  lastPurchaseAt: string | null;
}

function parsePurchaseSort(value: unknown): PurchaseSort {
  const raw = firstString(value);
  if (raw === "articles" || raw === "stockValue" || raw === "cost") return raw;
  return "cost";
}

function purchaseRows(
  articles: Array<{
    code: string;
    purchasePrice: number;
    stock: number;
    supplierId: number | null;
    updatedAt: Date;
    supplierInfo: { id: number; name: string } | null;
  }>,
  soldItems: Array<{ articleCode: string | null; quantity: number }>,
  period: ReportPeriod,
): PurchaseRow[] {
  const soldUnits = new Map<string, number>();
  for (const item of soldItems) {
    if (!item.articleCode) continue;
    soldUnits.set(item.articleCode, (soldUnits.get(item.articleCode) ?? 0) + item.quantity);
  }

  const bySupplier = new Map<number, PurchaseRow>();

  for (const article of articles) {
    const key = article.supplierId ?? 0;
    const row = bySupplier.get(key) ?? {
      supplierId: article.supplierId,
      supplierName: article.supplierInfo?.name ?? "Sin proveedor",
      articles: 0,
      purchasedArticles: 0,
      cost: 0,
      stockValue: 0,
      idleStockValue: 0,
      soldUnits: 0,
      lastPurchaseAt: null,
    };

    // No hay una entidad "Compra" en el modelo: la mejor señal disponible de
    // ingreso/actualización de inventario es Article.updatedAt dentro del
    // período. El costo se calcula con el stock y el costo actuales.
    const purchasedInPeriod =
      article.updatedAt.getTime() >= period.from.getTime() &&
      article.updatedAt.getTime() <= period.to.getTime();
    const stockValue = article.purchasePrice * article.stock;

    row.articles += 1;
    row.stockValue += stockValue;
    if (purchasedInPeriod) {
      row.purchasedArticles += 1;
      row.cost += stockValue;
      const previous = row.lastPurchaseAt ? new Date(row.lastPurchaseAt) : null;
      if (!previous || article.updatedAt > previous) {
        row.lastPurchaseAt = article.updatedAt.toISOString();
      }
    }
    if (!soldUnits.has(article.code)) {
      row.idleStockValue += stockValue;
    }
    row.soldUnits += soldUnits.get(article.code) ?? 0;

    bySupplier.set(key, row);
  }

  return [...bySupplier.values()].map((row) => ({
    ...row,
    cost: roundMoney(row.cost),
    stockValue: roundMoney(row.stockValue),
    idleStockValue: roundMoney(row.idleStockValue),
  }));
}

function purchaseSummary(rows: PurchaseRow[]) {
  return {
    suppliers: rows.length,
    articles: rows.reduce((sum, row) => sum + row.articles, 0),
    purchasedArticles: rows.reduce((sum, row) => sum + row.purchasedArticles, 0),
    cost: roundMoney(rows.reduce((sum, row) => sum + row.cost, 0)),
    stockValue: roundMoney(rows.reduce((sum, row) => sum + row.stockValue, 0)),
    idleStockValue: roundMoney(rows.reduce((sum, row) => sum + row.idleStockValue, 0)),
    soldUnits: rows.reduce((sum, row) => sum + row.soldUnits, 0),
  };
}

function sortPurchases(rows: PurchaseRow[], sortBy: PurchaseSort): PurchaseRow[] {
  return [...rows].sort((a, b) => {
    const metric =
      sortBy === "articles"
        ? b.articles - a.articles
        : sortBy === "stockValue"
          ? b.stockValue - a.stockValue
          : b.cost - a.cost;
    return metric || b.stockValue - a.stockValue || a.supplierName.localeCompare(b.supplierName, "es");
  });
}

async function loadSoldItemsForPurchases(period: ReportPeriod) {
  return prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: period.from, lte: period.to } } },
    select: { articleCode: true, quantity: true },
  });
}

export async function purchasesReport(req: Request, res: Response) {
  const common = commonFilters(req, res);
  if (!common) return;

  const supplier = optionalPositiveId(req.query.supplierId, "proveedor");
  if (!supplier.ok) {
    res.status(400).json({ error: supplier.error });
    return;
  }

  const onlyWithPurchases = optionalBoolean(req.query.onlyWithPurchases, "onlyWithPurchases");
  if (!onlyWithPurchases.ok) {
    res.status(400).json({ error: onlyWithPurchases.error });
    return;
  }

  const sortBy = parsePurchaseSort(req.query.sortBy);

  const articles = await prisma.article.findMany({
    where: supplier.id !== undefined ? { supplierId: supplier.id } : {},
    include: { supplierInfo: true },
    orderBy: { name: "asc" },
  });

  const currentSold = await loadSoldItemsForPurchases(common.period);
  let allRows = sortPurchases(purchaseRows(articles, currentSold, common.period), sortBy);
  if (onlyWithPurchases.value === true) {
    allRows = allRows.filter((row) => row.purchasedArticles > 0);
  }

  const page = paginate(allRows, common.pagination);

  let previous: { summary: ReturnType<typeof purchaseSummary>; rows: PurchaseRow[] } | null = null;
  if (common.previousPeriod) {
    const previousSold = await loadSoldItemsForPurchases(common.previousPeriod);
    let previousRows = sortPurchases(
      purchaseRows(articles, previousSold, common.previousPeriod),
      sortBy,
    );
    if (onlyWithPurchases.value === true) {
      previousRows = previousRows.filter((row) => row.purchasedArticles > 0);
    }
    previous = {
      summary: purchaseSummary(previousRows),
      rows: paginate(previousRows, common.pagination).rows,
    };
  }

  return res.json({
    ...reportEnvelope(
      common,
      purchaseSummary(allRows),
      page.rows,
      { bySupplier: allRows },
      previous,
    ),
    pagination: page.info,
    sortBy,
  });
}

/* ------------------------------------------------------------------ */
/* Serie mensual                                                       */
/* ------------------------------------------------------------------ */

export async function monthlyReport(req: Request, res: Response) {
  const yearRaw = firstString(req.query.year);
  const year = yearRaw === undefined || yearRaw === "" ? new Date().getFullYear() : Number(yearRaw);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    return res.status(400).json({
      error: "El año no es válido (debe ser un número entre 1900 y 2200)",
    });
  }

  const period: ReportPeriod = {
    kind: "year",
    from: new Date(year, 0, 1, 0, 0, 0, 0),
    to: new Date(year, 11, 31, 23, 59, 59, 999),
    year,
    label: `año ${year}`,
  };

  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: period.from, lte: period.to } },
    include: { items: { select: { quantity: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rows = MONTH_NAMES.map((name, index) => ({
    month: index + 1,
    label: name,
    total: 0,
    count: 0,
    units: 0,
    avgTicket: 0,
  }));

  for (const sale of sales) {
    const row = rows[sale.createdAt.getMonth()];
    row.total += sale.total;
    row.count += 1;
    row.units += sale.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  for (const row of rows) {
    row.total = roundMoney(row.total);
    row.avgTicket = row.count ? roundMoney(row.total / row.count) : 0;
  }

  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const units = rows.reduce((sum, row) => sum + row.units, 0);

  return res.json({
    period: serializePeriod(period),
    year,
    summary: {
      total: roundMoney(total),
      count,
      units,
      avgTicket: count ? roundMoney(total / count) : 0,
    },
    rows,
    groups: { byMonth: rows },
  });
}
