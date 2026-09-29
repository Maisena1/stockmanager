import { api } from "./api"

export type ExistingPolicy = "sumStock" | "updatePrice" | "skip"

export type ColumnField =
  | "code"
  | "name"
  | "category"
  | "motorcycleModel"
  | "purchasePrice"
  | "salePrice"
  | "stock"
  | "barcode"

export interface ImportColumns {
  code: number | null
  name: number
  category: number | null
  motorcycleModel: number | null
  purchasePrice: number | null
  salePrice: number | null
  stock: number | null
  barcode: number | null
}

export interface ImportConfig {
  supplier: string
  motorcycleModel: string
  percentage: number
  useExcelPrice: boolean
  includeZeroRows: boolean
  minStock: number
  defaultQuantity: number
  existing: ExistingPolicy
  hasHeader: boolean
  columns: ImportColumns
}

export interface SheetPreview {
  name: string
  rows: unknown[][]
}

export interface PreviewResponse {
  sheets: SheetPreview[]
}

export interface RowError {
  sheet: string
  row: number
  message: string
}

export interface SkippedRow {
  sheet: string
  row: number
  reason: string
}

export interface ImportReport {
  created: number
  updated: number
  skipped: number
  errors: RowError[]
}

export interface ImportResponse {
  report: ImportReport
  imported: boolean
  skipped?: SkippedRow[]
}

/** Debe coincidir con MAX_MB de src/middlewares/upload.ts. */
export const MAX_UPLOAD_MB = 10

export const COLUMN_FIELDS: Array<{ field: ColumnField; label: string; required: boolean }> = [
  { field: "code", label: "Código", required: false },
  { field: "name", label: "Nombre", required: true },
  { field: "category", label: "Categoría", required: false },
  { field: "motorcycleModel", label: "Modelo de moto", required: false },
  { field: "purchasePrice", label: "Precio de compra", required: false },
  { field: "salePrice", label: "Precio de venta", required: false },
  { field: "stock", label: "Stock", required: false },
  { field: "barcode", label: "Código de barras", required: false },
]

export const DEFAULT_COLUMNS: ImportColumns = {
  code: null,
  name: 0,
  category: null,
  motorcycleModel: null,
  purchasePrice: null,
  salePrice: null,
  stock: null,
  barcode: null,
}

export const EXISTING_OPTIONS: Array<{ value: ExistingPolicy; label: string }> = [
  { value: "skip", label: "Saltar (no tocar los que ya existen)" },
  { value: "sumStock", label: "Sumar el stock al que ya existe" },
  { value: "updatePrice", label: "Actualizar el precio" },
]

export function previewImport(file: File): Promise<PreviewResponse> {
  const form = new FormData()
  form.append("file", file)
  return api.upload<PreviewResponse>("/import/preview", form)
}

export function runImport(
  file: File,
  config: ImportConfig,
  sheets?: string[],
): Promise<ImportResponse> {
  const form = new FormData()
  // multer solo lee req.body con los campos de texto que llegan ANTES del archivo
  form.append("config", JSON.stringify(config))
  if (sheets && sheets.length > 0) {
    form.append("sheets", JSON.stringify(sheets))
  }
  form.append("file", file)
  return api.upload<ImportResponse>("/import", form)
}

export function sheetColumnCount(sheet: SheetPreview): number {
  return sheet.rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
}

/** Cabeceras de la primera fila, para etiquetar los selects de mapeo. */
export function sheetHeaders(sheet: SheetPreview): string[] {
  const first = sheet.rows[0]
  if (!Array.isArray(first)) return []
  return first.map((cell, i) => {
    const text = String(cell ?? "").trim()
    return text === "" ? `Columna ${i + 1}` : text
  })
}

const HEADER_PATTERNS: Array<[ColumnField, RegExp]> = [
  ["barcode", /^(c[oó]digo\s*(de\s*)?barras|barras|barcode|ean)/i],
  ["code", /^(c[oó]digo|ref|cod|sku|clave)/i],
  ["name", /^(nombre|descripci|art[íi]culo|producto|item|name)/i],
  ["category", /^(categor)/i],
  ["motorcycleModel", /^(modelo|moto)/i],
  ["salePrice", /^(precio\s*(de\s*)?venta|venta|valor\s*venta|sale)/i],
  ["purchasePrice", /^(costo|coste|compra|precio(\s*unit)?|purchase)/i],
  ["stock", /^(stock|existencia|cantidad|qty|quantity)/i],
]

/**
 * Adivina el mapeo de columnas a partir de la fila de encabezado. Es una
 * sugerencia: el usuario puede corregir cualquiera de los selects.
 */
export function guessColumns(headers: string[]): ImportColumns {
  const columns: ImportColumns = { ...DEFAULT_COLUMNS }
  const taken = new Set<number>()

  headers.forEach((header, index) => {
    for (const [field, pattern] of HEADER_PATTERNS) {
      if (columns[field] !== null || taken.has(index)) continue
      if (pattern.test(header)) {
        columns[field] = index
        taken.add(index)
        break
      }
    }
  })

  // Sin coincidencia: la primera columna es el nombre, que es lo único obligatorio
  if (columns.name === null && headers.length > 0) {
    columns.name = 0
  }
  return columns
}

export function validateFile(file: File): string | null {
  if (!/\.xlsx$/i.test(file.name)) {
    return "El archivo tiene que ser un .xlsx"
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `El archivo supera el límite de ${MAX_UPLOAD_MB} MB`
  }
  return null
}
