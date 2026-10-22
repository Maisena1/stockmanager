import { api } from "./api"

export type ReportTab = "ventas" | "top" | "stock" | "compras"
export type ReportPeriodKind = "day" | "month" | "year" | "range"
export type CompareMode = "previous" | "previousMonth" | "none"
export type PaymentMethod = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA"
export type Criticality = "low" | "critical" | "out"

export interface ReportPeriod {
  kind: ReportPeriodKind
  from: string
  to: string
  label: string
  year: number
  month?: number
}

export interface ReportPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  all: boolean
}

export interface SalesReportRow {
  id: number
  date: string
  sellerId: number
  seller: string
  itemCount: number
  units: number
  total: number
  paymentMethod: PaymentMethod
}

export interface SalesReportSummary {
  total: number
  count: number
  avgTicket: number
  units: number
}

export interface SalesReport {
  period: ReportPeriod
  previousPeriod: ReportPeriod | null
  compareWith: CompareMode
  pagination: ReportPagination
  summary: SalesReportSummary
  rows: SalesReportRow[]
  groups: {
    byDay: Array<{ date: string; total: number; count: number; units: number }>
    bySeller: Array<{
      userId: number
      seller: string
      total: number
      count: number
      units: number
    }>
  }
  previous: {
    period: ReportPeriod | null
    summary: SalesReportSummary
    rows: SalesReportRow[]
  } | null
}

export interface ProductReportRow {
  code: string | null
  name: string
  category: string
  motorcycleModel: string
  supplierId: number | null
  supplierName: string | null
  stock: number
  minStock?: number
  purchasePrice?: number
  salePrice: number
  units: number
  revenue: number
  cost: number
  margin: number
  marginPct: number
  deleted?: boolean
}

export interface ProductReportSummary {
  units: number
  revenue: number
  margin: number
  products: number
}

export type ProductSort = "units" | "revenue" | "margin"

export interface TopProductsReport {
  period: ReportPeriod
  previousPeriod: ReportPeriod | null
  compareWith: CompareMode
  pagination: ReportPagination
  summary: ProductReportSummary
  rows: ProductReportRow[]
  groups: {
    byCategory: Array<{
      category: string
      units: number
      revenue: number
      margin: number
      products: number
    }>
  }
  previous: {
    period: ReportPeriod | null
    summary: ProductReportSummary
    rows: ProductReportRow[]
  } | null
  sortBy: ProductSort
}

export interface LowStockReportRow {
  code: string
  name: string
  category: string
  motorcycleModel: string
  supplierId: number | null
  supplierName: string | null
  stock: number
  minStock: number
  purchasePrice?: number
  stockValue: number
  shortage: number
  suggestedOrder: number
  criticality: Criticality
}

export interface LowStockReportSummary {
  articles: number
  low: number
  critical: number
  out: number
  stockValue: number
  suggestedUnits: number
}

export interface LowStockReport {
  period: ReportPeriod
  previousPeriod: null
  compareWith: "none"
  pagination: ReportPagination
  summary: LowStockReportSummary
  rows: LowStockReportRow[]
  groups: {
    bySupplier: Array<{
      supplierId: number | null
      supplierName: string
      articles: number
      critical: number
      out: number
      stockValue: number
      suggestedOrder: number
    }>
  }
  previous: null
}

export type PurchaseSort = "cost" | "articles" | "stockValue"

export interface PurchaseReportRow {
  supplierId: number | null
  supplierName: string
  articles: number
  purchasedArticles: number
  cost: number
  stockValue: number
  idleStockValue: number
  soldUnits: number
  lastPurchaseAt: string | null
}

export interface PurchaseReportSummary {
  suppliers: number
  articles: number
  purchasedArticles: number
  cost: number
  stockValue: number
  idleStockValue: number
  soldUnits: number
}

export interface PurchasesReport {
  period: ReportPeriod
  previousPeriod: ReportPeriod | null
  compareWith: CompareMode
  pagination: ReportPagination
  summary: PurchaseReportSummary
  rows: PurchaseReportRow[]
  groups: { bySupplier: PurchaseReportRow[] }
  previous: {
    period: ReportPeriod | null
    summary: PurchaseReportSummary
    rows: PurchaseReportRow[]
  } | null
  sortBy: PurchaseSort
}

export interface MonthlyReport {
  period: ReportPeriod
  year: number
  summary: { total: number; count: number; units: number; avgTicket: number }
  rows: Array<{
    month: number
    label: string
    total: number
    count: number
    units: number
    avgTicket: number
  }>
  groups: { byMonth: MonthlyReport["rows"] }
}

export type ReportFilters = Partial<
  Record<
    | "from"
    | "to"
    | "year"
    | "month"
    | "compareWith"
    | "page"
    | "limit"
    | "all"
    | "userId"
    | "paymentMethod"
    | "minTotal"
    | "maxTotal"
    | "supplierId"
    | "category"
    | "motorcycleModel"
    | "onlyWithSales"
    | "sortBy"
    | "criticality"
    | "includeZeroStock"
    | "onlyWithPurchases",
    string | number | boolean
  >
>

function toQuery(filters: ReportFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}

export function getSalesReport(filters: ReportFilters = {}): Promise<SalesReport> {
  return api.get<SalesReport>(`/reports/sales${toQuery(filters)}`)
}

export function getTopProductsReport(filters: ReportFilters = {}): Promise<TopProductsReport> {
  return api.get<TopProductsReport>(`/reports/top-products${toQuery(filters)}`)
}

export function getLowStockReport(filters: ReportFilters = {}): Promise<LowStockReport> {
  return api.get<LowStockReport>(`/reports/low-stock${toQuery(filters)}`)
}

export function getPurchasesReport(filters: ReportFilters = {}): Promise<PurchasesReport> {
  return api.get<PurchasesReport>(`/reports/purchases${toQuery(filters)}`)
}

export function getMonthlyReport(year: number): Promise<MonthlyReport> {
  return api.get<MonthlyReport>(`/reports/monthly?year=${year}`)
}

export function toInputDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayInputDate(): string {
  return toInputDate(new Date())
}

export function addDaysInputDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return toInputDate(date)
}

export function monthRangeInputDate(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 0)
  return { from: toInputDate(from), to: toInputDate(to) }
}

/** Último mes calendario completo; es el período por defecto de los reportes. */
export function defaultReportRange(now = new Date()): { from: string; to: string } {
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return monthRangeInputDate(previousMonth.getFullYear(), previousMonth.getMonth() + 1)
}
