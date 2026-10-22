import type { ReportPeriod, ReportTab } from "./reports"

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const

const REPORT_SLUGS: Record<ReportTab, string> = {
  ventas: "ventas",
  top: "mas-vendidos",
  stock: "bajo-stock",
  compras: "compras-por-proveedor",
}

const FILTER_PREFIXES: Record<string, string> = {
  userId: "vend",
  paymentMethod: "pago",
  minTotal: "min",
  maxTotal: "max",
  supplierId: "prov",
  category: "cat",
  motorcycleModel: "mod",
  criticality: "crit",
}

const MAX_FILENAME_BASE = 200

export interface ReportFilenameFilter {
  key: string
  label: string
}

export interface ReportFilenameInput {
  tab: ReportTab
  period: ReportPeriod
  filters: ReportFilenameFilter[]
}

/** Convierte cualquier texto en una parte segura para un nombre de archivo. */
export function slugifyFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function dateSlug(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-")
  if (!year || !month || !day) return slugifyFilenamePart(value)
  return `${day}-${month}-${year}`
}

function periodSlug(period: ReportPeriod): string {
  if (period.kind === "month") {
    return `${MONTH_NAMES[(period.month ?? 1) - 1]}-${period.year}`
  }
  if (period.kind === "year") return String(period.year)
  if (period.kind === "day") return dateSlug(period.from)
  return `${dateSlug(period.from)}-a-${dateSlug(period.to)}`
}

function filterSlug(filter: ReportFilenameFilter): string {
  if (filter.key === "compare") return "vs-periodo-anterior"
  if (filter.key === "onlyWithSales") {
    return filter.label.startsWith("Incluye") ? "incluye-sin-ventas" : "solo-ventas"
  }
  if (filter.key === "includeZeroStock") {
    return filter.label.startsWith("Excluye") ? "sin-agotados" : "con-agotados"
  }
  if (filter.key === "onlyWithPurchases") return "solo-compras"
  if (filter.key === "sortBy") {
    const value = filter.label.includes(":")
      ? filter.label.slice(filter.label.indexOf(":") + 1)
      : filter.label
    return `orden-${slugifyFilenamePart(value)}`
  }

  const prefix = FILTER_PREFIXES[filter.key]
  if (prefix) {
    const value = filter.label.includes(":")
      ? filter.label.slice(filter.label.indexOf(":") + 1)
      : filter.label
    return `${prefix}-${slugifyFilenamePart(value)}`
  }

  return slugifyFilenamePart(filter.label)
}

/**
 * Nombre del PDF: reporte + todos los filtros activos + período.
 *
 * Ejemplo:
 * reporte-de-ventas-vend-maria-pago-efectivo-septiembre-2026.pdf
 */
export function buildReportFilename(input: ReportFilenameInput): string {
  const parts = ["reporte", "de", REPORT_SLUGS[input.tab]]

  for (const filter of input.filters) {
    const part = filterSlug(filter)
    if (part) parts.push(part)
  }

  parts.push(periodSlug(input.period))

  const base = slugifyFilenamePart(parts.join(" ")).slice(0, MAX_FILENAME_BASE)
  return `${base.replace(/-+$/g, "") || "reporte"}.pdf`
}
