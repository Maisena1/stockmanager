import { normalizeUpperCase } from "./normalizar";
import { calculateSalePrice } from "./precio";

export interface ImportColumns {
  code?: number | null;
  name?: number | null;
  category?: number | null;
  motorcycleModel?: number | null;
  purchasePrice?: number | null;
  salePrice?: number | null;
  stock?: number | null;
  barcode?: number | null;
}

export interface ImportSettings {
  supplier: string;
  motorcycleModel: string;
  percentage: number;
  useExcelPrice: boolean;
  includeZeroRows: boolean;
  omitirFilasSinNombre: boolean;
  minStock: number;
  defaultQuantity: number;
  columns: ImportColumns;
  hasHeader: boolean;
  confirmDuplicate: boolean;
}

export interface SheetData {
  name: string;
  rows: unknown[][];
}

export interface ExistingArticle {
  code: string;
  name: string;
  stock: number;
  purchasePrice: number;
  salePrice: number;
}

export interface ParsedRow {
  sheet: string;
  row: number;
  name: string;
  code: string | null;
  category: string;
  motorcycleModel: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  supplier: string;
  barcode: string | null;
}

export interface CreatePlanEntry {
  row: ParsedRow;
  code: string | null;
}

export interface UpdatePlanEntry {
  sheet: string;
  row: number;
  name: string;
  code: string;
  data: { stock?: number; purchasePrice?: number; salePrice?: number };
}

export interface RowError {
  sheet: string;
  row: number;
  message: string;
}

export interface SkippedRow {
  sheet: string;
  row: number;
  reason: string;
}

export interface ImportPlan {
  toCreate: CreatePlanEntry[];
  toUpdate: UpdatePlanEntry[];
  skipped: SkippedRow[];
  errors: RowError[];
}

export interface ImportReport {
  created: number;
  updated: number;
  skipped: number;
  errors: RowError[];
  warnings?: string[];
}

export type SettingsParseResult =
  | { ok: true; settings: ImportSettings }
  | { ok: false; error: string };

const COLUMN_KEYS: Array<keyof ImportColumns> = [
  "code",
  "name",
  "category",
  "motorcycleModel",
  "purchasePrice",
  "salePrice",
  "stock",
  "barcode",
];

export const DEFAULT_COLUMNS: Required<ImportColumns> = {
  code: null,
  name: 0,
  category: 1,
  motorcycleModel: 2,
  purchasePrice: 3,
  salePrice: null,
  stock: 4,
  barcode: 5,
};

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "on", "yes", "si", "sí"].includes(text)) return true;
  if (["false", "0", "off", "no"].includes(text)) return false;
  return fallback;
}

function toText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === undefined || value === null) return null;

  let raw = String(value).trim().replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (raw === "" || raw === "-" || raw === "." || raw === ",") return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    // Con los dos separadores, el que está más a la derecha es el decimal.
    raw = lastComma > lastDot
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (lastComma !== -1) {
    raw = /,\d{1,2}$/.test(raw) ? raw.replace(",", ".") : raw.replace(/,/g, "");
  } else if (lastDot !== -1 && /^-?\d{1,3}(\.\d{3})+$/.test(raw)) {
    // "2.500" es un millar, no un decimal.
    raw = raw.replace(/\./g, "");
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toColumnIndex(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parseColumns(input: unknown): ImportColumns {
  let source: Record<string, unknown> = {};
  if (typeof input === "string" && input.trim() !== "") {
    try {
      source = JSON.parse(input) as Record<string, unknown>;
    } catch {
      return { ...DEFAULT_COLUMNS };
    }
  } else if (input && typeof input === "object") {
    source = input as Record<string, unknown>;
  }
  const columns: ImportColumns = { ...DEFAULT_COLUMNS };
  for (const key of COLUMN_KEYS) {
    if (source[key] === undefined) continue;
    columns[key] = toColumnIndex(source[key]);
  }
  return columns;
}

export function parseSettings(input: unknown): SettingsParseResult {
  let source: Record<string, unknown>;
  if (typeof input === "string") {
    const text = input.trim();
    if (text === "" || text === "undefined" || text === "null") {
      return { ok: false, error: "Falta la configuración de importación" };
    }
    try {
      source = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "La configuración no es un JSON válido" };
    }
  } else if (input && typeof input === "object") {
    source = input as Record<string, unknown>;
  } else {
    return { ok: false, error: "Falta la configuración de importación" };
  }

  const supplier = toText(source.supplier);
  if (!supplier) return { ok: false, error: "El proveedor es obligatorio" };

  const percentage = toNumber(source.percentage);
  if (percentage === null) return { ok: false, error: "El % de ganancia es obligatorio" };
  if (percentage < 0) return { ok: false, error: "El % de ganancia no puede ser negativo" };

  const minStock = toNumber(source.minStock);
  if (minStock !== null && minStock < 0) {
    return { ok: false, error: "El stock mínimo no puede ser negativo" };
  }

  const defaultQuantity = toNumber(source.defaultQuantity);
  if (defaultQuantity !== null && defaultQuantity < 0) {
    return { ok: false, error: "La cantidad estándar no puede ser negativa" };
  }

  const useExcelPrice = toBoolean(source.useExcelPrice, false);
  const columns = parseColumns(source.columns);

  if (!columns.name && columns.name !== 0) {
    return { ok: false, error: "Hay que mapear la columna del nombre" };
  }
  if (useExcelPrice && columns.salePrice === null) {
    return {
      ok: false,
      error: "Para usar el precio del Excel hay que mapear la columna de precio de venta",
    };
  }

  return {
    ok: true,
    settings: {
      supplier,
      motorcycleModel: toText(source.motorcycleModel),
      percentage,
      useExcelPrice,
      includeZeroRows: toBoolean(source.includeZeroRows, false),
      omitirFilasSinNombre: toBoolean(source.omitirFilasSinNombre, true),
      minStock: minStock ?? 0,
      defaultQuantity: defaultQuantity ?? 1,
      columns,
      hasHeader: toBoolean(source.hasHeader, true),
      confirmDuplicate: toBoolean(source.confirmDuplicate, false),
    },
  };
}

function cell(row: unknown[], index: number | null | undefined): unknown {
  if (index === null || index === undefined) return undefined;
  return row[index];
}

function cellText(row: unknown[], index: number | null | undefined): string {
  return toText(cell(row, index));
}

function cellNumber(row: unknown[], index: number | null | undefined): number | null {
  return index === null || index === undefined ? null : toNumber(cell(row, index));
}

/**
 * ¿La fila tiene algo en las columnas que importan? Las listas de precios de
 * los proveedores dejan muchas filas de continuación (talles, accesorios) con
 * todo vacío salvo el texto del producto de arriba. No son un error de datos,
 * son filas sin nada que importar.
 */
function hasMappedData(row: unknown[], columns: ImportColumns): boolean {
  const indexes = [
    columns.code,
    columns.name,
    columns.purchasePrice,
    columns.salePrice,
    columns.stock,
  ];
  return indexes.some((index) => {
    if (index === null || index === undefined) return false;
    const value = cell(row, index);
    if (value === undefined || value === null) return false;
    // Un 0 explícito es un dato: lo descarta después la regla de precio 0.
    if (typeof value === "string") return value.trim() !== "";
    return true;
  });
}

/**
 * Acepta el array de hojas ya parseado, un JSON en string o una lista separada
 * por comas. Devuelve null cuando no se envió nada (importar todas).
 */
export function parseSheetNames(input: unknown): string[] | null {
  if (Array.isArray(input)) {
    const names = input.map((s) => String(s).trim()).filter(Boolean);
    return names.length > 0 ? names : null;
  }
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (text === "" || text === "undefined" || text === "null") return null;
  if (text.startsWith("[")) {
    try {
      return parseSheetNames(JSON.parse(text));
    } catch {
      return null;
    }
  }
  const names = text.split(",").map((s) => s.trim()).filter(Boolean);
  return names.length > 0 ? names : null;
}

export function selectSheets(
  sheets: SheetData[],
  selected?: string[] | null,
): SheetData[] {
  if (!selected || selected.length === 0) return sheets;
  const wanted = new Set(selected);
  return sheets.filter((s) => wanted.has(s.name));
}

export function buildPlan(
  sheets: SheetData[],
  settings: ImportSettings,
  existingByName: Map<string, ExistingArticle> = new Map(),
): ImportPlan {
  const plan: ImportPlan = { toCreate: [], toUpdate: [], skipped: [], errors: [] };
  const pendingCreatesByName = new Map<string, ParsedRow>();
  const pendingCreateStocks = new Map<string, number>();
  const pendingUpdatesByCode = new Map<string, UpdatePlanEntry>();

  for (const sheet of sheets) {
    const start = settings.hasHeader ? 1 : 0;
    for (let i = start; i < sheet.rows.length; i++) {
      const source = sheet.rows[i];
      if (!Array.isArray(source) || source.length === 0) continue;
      const rowNumber = i + 1;

      // Va antes de validar el nombre: una fila totalmente vacía en las columnas
      // mapeadas se omite, no se reporta como error. Si fuera error, el todo o
      // nada de RNF-30 cancelaría la importación entera por basura del proveedor.
      if (!hasMappedData(source, settings.columns)) {
        plan.skipped.push({ sheet: sheet.name, row: rowNumber, reason: "Fila sin datos" });
        continue;
      }

      const name = cellText(source, settings.columns.name);
      if (!name) {
        const message = "Falta el nombre del artículo";
        if (settings.omitirFilasSinNombre) {
          plan.skipped.push({ sheet: sheet.name, row: rowNumber, reason: message });
        } else {
          plan.errors.push({ sheet: sheet.name, row: rowNumber, message });
        }
        continue;
      }

      const purchasePrice = cellNumber(source, settings.columns.purchasePrice) ?? 0;
      const stockValue = cellNumber(source, settings.columns.stock);
      const stock = stockValue ?? settings.defaultQuantity;
      const salePriceValue = cellNumber(source, settings.columns.salePrice);

      if (purchasePrice < 0 || stock < 0) {
        plan.errors.push({
          sheet: sheet.name,
          row: rowNumber,
          message: "Los precios y las cantidades no pueden ser negativos",
        });
        continue;
      }

      if (!settings.includeZeroRows && (purchasePrice === 0 || stock === 0)) {
        plan.skipped.push({
          sheet: sheet.name,
          row: rowNumber,
          reason: "Fila con precio o cantidad en 0",
        });
        continue;
      }

      const nameKey = normalizeUpperCase(name);
      const salePrice =
        settings.useExcelPrice && salePriceValue !== null
          ? salePriceValue
          : calculateSalePrice(purchasePrice, settings.percentage);

      // El emparejamiento es solo por nombre (normalizado): el código del Excel
      // se ignora a propósito. Si el nombre ya existe, se actualizan precio y
      // stock (sumando al que ya tenía) sin crear un duplicado.
      const existingArticle = existingByName.get(nameKey);
      if (existingArticle) {
        const articleCode = normalizeUpperCase(existingArticle.code);
        const entry = pendingUpdatesByCode.get(articleCode);
        if (entry) {
          entry.data.stock = (entry.data.stock ?? existingArticle.stock) + stock;
          entry.data.purchasePrice = purchasePrice;
          entry.data.salePrice = salePrice;
        } else {
          pendingUpdatesByCode.set(articleCode, {
            sheet: sheet.name,
            row: rowNumber,
            name,
            code: articleCode,
            data: {
              purchasePrice,
              salePrice,
              stock: existingArticle.stock + stock,
            },
          });
        }
        continue;
      }

      if (pendingCreatesByName.has(nameKey)) {
        const currentStock = pendingCreateStocks.get(nameKey) || 0;
        pendingCreateStocks.set(nameKey, currentStock + stock);
        const pending = pendingCreatesByName.get(nameKey);
        if (pending) {
          pending.purchasePrice = purchasePrice;
          pending.salePrice = salePrice;
        }
        continue;
      }

      const parsedRow: ParsedRow = {
        sheet: sheet.name,
        row: rowNumber,
        name,
        code: null,
        category: cellText(source, settings.columns.category) || "Sin categoría",
        motorcycleModel:
          settings.motorcycleModel ||
          cellText(source, settings.columns.motorcycleModel) ||
          "Universal",
        purchasePrice,
        salePrice,
        stock,
        minStock: settings.minStock,
        supplier: settings.supplier,
        barcode: cellText(source, settings.columns.barcode) || null,
      };

      pendingCreatesByName.set(nameKey, parsedRow);
      pendingCreateStocks.set(nameKey, stock);
    }
  }

  for (const entry of pendingUpdatesByCode.values()) {
    plan.toUpdate.push(entry);
  }

  for (const [nameKey, row] of pendingCreatesByName) {
    const totalStock = pendingCreateStocks.get(nameKey) || row.stock;
    plan.toCreate.push({
      code: row.code,
      row: {
        ...row,
        stock: totalStock,
      },
    });
  }

  return plan;
}

export function summarize(plan: ImportPlan): ImportReport {
  return {
    created: plan.toCreate.length,
    updated: plan.toUpdate.length,
    skipped: plan.skipped.length,
    errors: plan.errors,
  };
}
