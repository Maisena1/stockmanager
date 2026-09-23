import { Request, Response } from "express";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";
import { calculateSalePrice } from "../utils/precio";
import { normalizeUpperCase } from "../utils/normalizar";

function parseJson<T>(value: unknown): T | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed[0] !== "[" && trimmed[0] !== "{") return undefined;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return undefined;
  }
}

function toBool(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "string" && value !== "" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function prefixFrom(name: string): string {
  return normalizeUpperCase(name).replace(/[^A-Z]/g, "").slice(0, 3) || "ART";
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function nextCode(tx: Tx, name: string): Promise<string> {
  const prefix = prefixFrom(name);
  const existing = await tx.article.findMany({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
  });

  let max = 0;
  for (const e of existing) {
    const num = parseInt(e.code.slice(prefix.length + 1), 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }

  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

interface Columnas {
  nombre: number;
  categoria?: number;
  precio: number;
  cantidad: number;
  barras?: number;
}

export async function preview(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "Archivo requerido" });
  }

  const buffer = req.file.buffer;
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return res.status(400).json({ error: "Archivo XLSX inválido" });
  }

  const sheets = workbook.SheetNames.map((name: string) => {
    const worksheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as unknown[][];
    return { name, rows };
  });

  return res.json({ sheets });
}

export async function importArticles(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "Archivo requerido" });
  }

  const {
    proveedor,
    modeloMoto,
    porcentajeGanancia,
    usarPrecioExcel,
    incluirFilaCero,
    stockMinimo,
    cantidadEstandar,
    opcionExistente,
    hojas,
    columnas,
  } = req.body as Record<string, unknown>;

  const cols = parseJson<Columnas>(columnas);
  if (!cols || typeof cols.nombre !== "number" || typeof cols.precio !== "number" || typeof cols.cantidad !== "number") {
    return res.status(400).json({ error: "Configuración de columnas incompleta" });
  }

  const selectedSheets = Array.isArray(hojas) && hojas.length > 0
    ? hojas.map(String)
    : undefined;

  const config = {
    proveedor: String(proveedor ?? "").trim(),
    modeloMoto: String(modeloMoto ?? "").trim(),
    porcentajeGanancia: toNumber(porcentajeGanancia, 0),
    usarPrecioExcel: toBool(usarPrecioExcel),
    incluirFilaCero: toBool(incluirFilaCero),
    stockMinimo: toNumber(stockMinimo, 0),
    cantidadEstandar: toNumber(cantidadEstandar, 1),
    opcionExistente: String(opcionExistente ?? "saltear"),
  };

  if (!config.proveedor || !config.modeloMoto) {
    return res.status(400).json({ error: "Faltan proveedor o modelo de moto" });
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  } catch {
    return res.status(400).json({ error: "Archivo XLSX inválido" });
  }

  type ParsedRow = {
    nombre: string;
    categoria: string;
    barras: string | null;
    precio: number;
    cantidad: number;
  };

  const sheetNames = selectedSheets ?? workbook.SheetNames;

  const parsed: ParsedRow[] = [];
  const errores: { fila: number; hoja: string; motivo: string }[] = [];

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

    rows.forEach((row, i) => {
      if (!row || (row as unknown[]).every((c) => c === undefined || c === null || c === "")) return;

      const raw = row as unknown[];
      const get = (idx?: number): unknown => (idx !== undefined ? raw[idx] : undefined);

      const nombre = String(get(cols.nombre) ?? "").trim();
      if (!nombre) {
        errores.push({ fila: i + 1, hoja: sheetName, motivo: "Nombre vacío" });
        return;
      }

      const precio = toNumber(get(cols.precio), 0);
      const cantidad = get(cols.cantidad) === undefined || get(cols.cantidad) === null
        ? config.cantidadEstandar
        : toNumber(get(cols.cantidad), 0);

      if (cantidad <= 0 || (precio <= 0 && !config.incluirFilaCero)) {
        errores.push({ fila: i + 1, hoja: sheetName, motivo: "Precio o cantidad en cero" });
        return;
      }

      parsed.push({
        nombre,
        categoria: String(get(cols.categoria) ?? "General").trim() || "General",
        barras: get(cols.barras) !== undefined ? String(get(cols.barras)).trim() || null : null,
        precio,
        cantidad: Math.floor(cantidad),
      });
    });
  }

  if (parsed.length === 0) {
    return res.status(400).json({ error: "No hay filas válidas para importar" });
  }

  const creados: string[] = [];
  const actualizados: string[] = [];
  const salteados: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (const p of parsed) {
        const code = await nextCode(tx, p.nombre);
        const existing = await tx.article.findUnique({ where: { code } });

        if (existing) {
          if (config.opcionExistente === "saltear") {
            salteados.push(code);
            continue;
          }

          const purchasePrice = existing.purchasePrice;
          const salePrice = config.usarPrecioExcel
            ? p.precio
            : calculateSalePrice(purchasePrice, config.porcentajeGanancia);

          if (config.opcionExistente === "sumarStock") {
            await tx.article.update({
              where: { code },
              data: { stock: { increment: p.cantidad }, salePrice },
            });
          } else {
            await tx.article.update({
              where: { code },
              data: { purchasePrice: p.precio, salePrice, stock: p.cantidad },
            });
          }
          actualizados.push(code);
        } else {
          const purchasePrice = p.precio;
          const salePrice = config.usarPrecioExcel
            ? p.precio
            : calculateSalePrice(purchasePrice, config.porcentajeGanancia);

          await tx.article.create({
            data: {
              code,
              name: p.nombre,
              category: p.categoria,
              motorcycleModel: config.modeloMoto,
              purchasePrice,
              salePrice,
              stock: p.cantidad,
              minStock: config.stockMinimo,
              supplier: config.proveedor,
              barcode: p.barras,
            },
          });
          creados.push(code);
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ error: `Error al importar: ${err instanceof Error ? err.message : "desconocido"}` });
  }

  return res.json({ creados, actualizados, salteados, errores });
}