import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { serializeArticle } from "../utils/serialize";
import { calculateSalePrice } from "../utils/precio";
import { generateCode } from "../utils/codigo";
import { logAudit } from "../lib/audit";
import { lowStockWhere } from "../lib/lowStock";
import { parsePositiveId } from "../utils/proveedores";
import { firstString, parseBooleanQuery, parseDateQuery } from "../utils/query";
import fs from "node:fs";
import path from "node:path";

type SupplierResolution =
  | { ok: true; supplierId: number }
  | { ok: false; error: string };

async function resolveSupplierInput(data: Record<string, unknown>): Promise<SupplierResolution> {
  const id = parsePositiveId(data.supplierId);
  if (id === null) {
    return { ok: false, error: "El proveedor seleccionado no es válido" };
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!supplier) {
    return { ok: false, error: "El proveedor seleccionado no existe" };
  }
  return { ok: true, supplierId: supplier.id };
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}


export async function list(req: Request, res: Response) {
  const role = req.user!.role;
  const q = firstString(req.query.q);
  const name = firstString(req.query.name);
  const category = firstString(req.query.category);
  const model = firstString(req.query.model);
  const supplier = firstString(req.query.supplier);
  const supplierIdRaw = firstString(req.query.supplierId);

  const lowStock = parseBooleanQuery(req.query.lowStock);
  if (lowStock === null) {
    return res.status(400).json({ error: "El filtro lowStock debe ser true o false" });
  }

  const updatedFrom = parseDateQuery(req.query.updatedFrom, false);
  if (updatedFrom === null) {
    return res.status(400).json({ error: "La fecha updatedFrom no es válida (formato AAAA-MM-DD)" });
  }
  const updatedTo = parseDateQuery(req.query.updatedTo, true);
  if (updatedTo === null) {
    return res.status(400).json({ error: "La fecha updatedTo no es válida (formato AAAA-MM-DD)" });
  }

  const where: Prisma.ArticleWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { motorcycleModel: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
      { supplierInfo: { is: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }
  if (name) where.name = { contains: name, mode: "insensitive" };
  if (category) where.category = { contains: category, mode: "insensitive" };
  if (model) where.motorcycleModel = { contains: model, mode: "insensitive" };
  if (supplier) {
    where.supplierInfo = { is: { name: { contains: supplier, mode: "insensitive" } } };
  }
  if (supplierIdRaw !== undefined && supplierIdRaw !== "") {
    const id = parsePositiveId(supplierIdRaw);
    if (id === null) {
      return res.status(400).json({ error: "El filtro de proveedor debe ser un número entero positivo" });
    }
    where.supplierId = id;
  }

  const updatedAt: Prisma.DateTimeFilter = {};
  if (updatedFrom) updatedAt.gte = updatedFrom;
  if (updatedTo) updatedAt.lte = updatedTo;
  if (updatedFrom || updatedTo) where.updatedAt = updatedAt;

  if (lowStock) {
    Object.assign(where, lowStockWhere());
  }

  const articles = await prisma.article.findMany({
    where,
    include: { supplierInfo: true },
    orderBy: [{ updatedAt: "desc" }, { code: "asc" }],
  });
  return res.json(articles.map((a) => serializeArticle(a, role)));
}

export async function getOne(req: Request, res: Response) {
  const code = String(req.params.code);
  const role = req.user!.role;

  const article = await prisma.article.findUnique({
    where: { code },
    include: { supplierInfo: true },
  });
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
    data.stock == null || data.minStock == null ||
    data.supplierId == null
  ) {
    return res.status(400).json({ error: "Faltan campos obligatorios (incluido el proveedor)" });
  }

  const supplier = await resolveSupplierInput(data);
  if (!supplier.ok) {
    return res.status(400).json({ error: supplier.error });
  }

  const purchasePrice = Number(data.purchasePrice);
  const percentage = Number(data.percentage);
  const salePrice = calculateSalePrice(purchasePrice, percentage);
  const code = await generateCode(data.name);

  try {
    const article = await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          code,
          name: data.name,
          category: data.category,
          motorcycleModel: data.motorcycleModel,
          purchasePrice,
          salePrice,
          stock: Number(data.stock),
          minStock: Number(data.minStock),
          supplierId: supplier.supplierId,
          barcode: data.barcode || null,
        },
        include: { supplierInfo: true },
      });

      await logAudit(tx, {
        userId: req.user!.userId,
        action: "ARTICULO_CREADO",
        detail: `Artículo ${created.code} "${created.name}" creado`,
      });

      return created;
    });

    return res.status(201).json(serializeArticle(article, req.user!.role));
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(400).json({ error: "Ya existe un artículo con ese código o código de barras" });
    }
    throw err;
  }
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
  if (data.supplierId !== undefined) {
    if (data.supplierId === null) {
      updateData.supplierId = null;
    } else {
      const supplier = await resolveSupplierInput(data);
      if (!supplier.ok) {
        return res.status(400).json({ error: supplier.error });
      }
      updateData.supplierId = supplier.supplierId;
    }
  }
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

  const updatedFields = Object.keys(updateData);
  try {
    const article = await prisma.$transaction(async (tx) => {
      const updated = await tx.article.update({
        where: { code },
        data: updateData,
        include: { supplierInfo: true },
      });

      await logAudit(tx, {
        userId: req.user!.userId,
        action: "ARTICULO_ACTUALIZADO",
        detail: `Artículo ${code} "${updated.name}" actualizado (campos: ${updatedFields.join(", ")})`,
      });

      return updated;
    });

    return res.json(serializeArticle(article, req.user!.role));
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(400).json({ error: "Ya existe un artículo con ese código o código de barras" });
    }
    throw err;
  }
}

export async function remove(req: Request, res: Response) {
  const code = String(req.params.code);

  const existing = await prisma.article.findUnique({ where: { code } });
  if (!existing) {
    return res.status(404).json({ error: "Article not found" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.article.delete({ where: { code } });

    await logAudit(tx, {
      userId: req.user!.userId,
      action: "ARTICULO_ELIMINADO",
      detail: `Artículo ${existing.code} "${existing.name}" eliminado`,
    });
  });
  return res.status(204).send();
}

const UPLOADS_DIR = path.resolve(process.cwd(),"uploads");

function deleteFileSafe(filename: string | null | undefined) {
  if (!filename) return;
  try {
    const full = path.resolve(UPLOADS_DIR, path.basename(filename));
    if (full.startsWith(UPLOADS_DIR) && fs.existsSync(full)) fs.unlinkSync(full);
  } catch {

  }
}

export async function setPhoto(req: Request, res: Response) {
  const code = String(req.params.code);
  const existing = await prisma.article.findUnique({ where: { code } });
  if (!existing) {
    if (req.file) deleteFileSafe(req.file.filename);
    return res.status(404).json({ error: "Article not found" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Foto requerida" });
  }
  deleteFileSafe(existing.photo);
  const article = await prisma.article.update({
    where: { code },
    data: { photo: req.file.filename },
  });
  return res.json(article);
}

export async function removePhoto(req: Request, res:Response) {
  const code = String(req.params.code);
  const existing = await prisma.article.findUnique({ where: { code }});
  if (!existing) {
    return res.status(404).json({ error: "ARTICLE NOT FOUND"});
  }
  deleteFileSafe(existing.photo);
  const article = await prisma.article.update({
    where: {code}, data: {photo: null}
  });
  return res.json(article);
}
