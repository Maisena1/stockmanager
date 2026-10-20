import { Request, Response } from "express";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";
import { generateCodes } from "../utils/codigo";
import { normalizeUpperCase } from "../utils/normalizar";
import { normalizeSupplierName } from "../utils/proveedores";
import { logAudit } from "../lib/audit";
import {
  buildPlan,
  parseSettings,
  parseSheetNames,
  selectSheets,
  summarize,
  type ExistingArticle,
  type ImportReport,
  type SheetData,
} from "../utils/importar";

function readWorkbook(buffer: Buffer): XLSX.WorkBook | null {
  try {
    return XLSX.read(buffer, { type: "buffer" });
  } catch {
    return null;
  }
}

export async function preview(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "Archivo requerido" });
  }

  const workbook = readWorkbook(req.file.buffer);
  if (!workbook) {
    return res.status(400).json({ error: "Archivo XLSX inválido" });
  }

  const sheets = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as unknown[][];
    return { name, rows };
  });

  return res.json({ sheets });
}

export async function runImport(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "Archivo requerido" });
  }

  const parsed = parseSettings(req.body?.config);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }
  const settings = parsed.settings;

  const workbook = readWorkbook(req.file.buffer);
  if (!workbook) {
    return res.status(400).json({ error: "Archivo XLSX inválido" });
  }

  const allSheets: SheetData[] = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
    }) as unknown[][],
  }));

  const sheetNames = parseSheetNames(req.body?.sheets);

  const sheets = selectSheets(allSheets, sheetNames);
  if (sheets.length === 0) {
    return res.status(400).json({ error: "No se seleccionó ninguna hoja con datos" });
  }

  // El emparejamiento es por nombre normalizado, no por código. Se traen todos
  // los artículos y se indexan por nombre para tolerar acentos y mayúsculas.
  const existingArticles = await prisma.article.findMany({
    select: { code: true, name: true, stock: true, purchasePrice: true, salePrice: true },
  });
  const existingByName = new Map<string, ExistingArticle>(
    existingArticles.map((a) => [normalizeUpperCase(a.name), { ...a, name: a.name }]),
  );

  const plan = buildPlan(sheets, settings, existingByName);

  // Todo o nada (RNF-30): si alguna fila es inválida no se persiste nada,
  // pero el reporte deja claro qué habría pasado.
  if (plan.errors.length > 0) {
    const report: ImportReport = { ...summarize(plan), created: 0, updated: 0 };
    return res.status(400).json({
      error: `La importación se canceló: ${plan.errors.length} fila(s) con errores. No se importó nada.`,
      report,
      imported: false,
    });
  }

  const codesForNames = plan.toCreate
    .filter((entry) => !entry.code)
    .map((entry) => entry.row.name);
  const generated = await generateCodes(codesForNames);

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    let generatedIndex = 0;
    const supplierName = normalizeSupplierName(settings.supplier)!;

    let supplier = await tx.supplier.findFirst({
      where: { name: { equals: supplierName, mode: "insensitive" } },
    });
    if (!supplier) {
      supplier = await tx.supplier.create({ data: { name: supplierName } });
    }

    for (const entry of plan.toCreate) {
      const code = entry.code ?? generated[generatedIndex++];
      await tx.article.create({
        data: {
          code,
          name: entry.row.name,
          category: entry.row.category,
          motorcycleModel: entry.row.motorcycleModel,
          purchasePrice: entry.row.purchasePrice,
          salePrice: entry.row.salePrice,
          stock: entry.row.stock,
          minStock: entry.row.minStock,
          supplier: supplier.name,
          supplierId: supplier.id,
          barcode: entry.row.barcode,
        },
      });
      created++;
    }

    for (const entry of plan.toUpdate) {
      await tx.article.update({ where: { code: entry.code }, data: entry.data });
      updated++;
    }

    // Auditoría dentro de la misma transacción de la importación (RNF-30).
    await logAudit(tx, {
      userId: req.user!.userId,
      action: "IMPORTACION",
      detail: `Importación de Excel: ${created} creado(s), ${updated} actualizado(s), ${plan.skipped.length} salteado(s)`,
    });
  });

  const report: ImportReport = {
    created,
    updated,
    skipped: plan.skipped.length,
    errors: [],
  };

  return res.status(201).json({ report, imported: true, skipped: plan.skipped });
}
