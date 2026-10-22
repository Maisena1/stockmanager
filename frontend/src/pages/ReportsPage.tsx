import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { ApiError } from "../lib/api"
import { PeriodPicker } from "../components/PeriodPicker"
import { Variation } from "../components/Variation"
import { buildReportFilename } from "../lib/reportFilename"
import {
  exportReportPdf,
  type PdfChart,
  type PdfKpi,
  type PdfReportContent,
  type PdfTableRow,
  type PdfTableSection,
} from "../lib/reportPdf"
import { exportReportXlsx, type ExportColumn } from "../lib/reportExport"
import {
  defaultReportRange,
  getLowStockReport,
  getPurchasesReport,
  getSalesReport,
  getTopProductsReport,
  type LowStockReport,
  type LowStockReportRow,
  type PaymentMethod,
  type ProductReportRow,
  type PurchaseReportRow,
  type PurchasesReport,
  type ReportFilters,
  type ReportPagination,
  type ReportTab,
  type SalesReport,
  type SalesReportRow,
  type TopProductsReport,
} from "../lib/reports"
import { listSupplierOptions, type SupplierOption } from "../lib/suppliers"
import { listUsers, type ManagedUser } from "../lib/users"

const PAGE_SIZE = 20
const PDF_MAX_ROWS = 2500

const TAB_LABELS: Record<ReportTab, string> = {
  ventas: "Ventas",
  top: "Más vendidos",
  stock: "Bajo stock",
  compras: "Compras por proveedor",
}

const TAB_ORDER: ReportTab[] = ["ventas", "top", "stock", "compras"]

const SPECIFIC_KEYS: Record<ReportTab, Array<keyof ReportFilters>> = {
  ventas: ["userId", "paymentMethod", "minTotal", "maxTotal"],
  top: ["supplierId", "category", "motorcycleModel", "onlyWithSales", "sortBy"],
  stock: ["supplierId", "category", "criticality", "includeZeroStock"],
  compras: ["supplierId", "onlyWithPurchases", "sortBy"],
}

const ALL_SPECIFIC_KEYS = [...new Set(Object.values(SPECIFIC_KEYS).flat())]
const PAYMENT_METHODS: PaymentMethod[] = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"]

const PRODUCT_SORT_LABELS: Record<string, string> = {
  units: "Unidades",
  revenue: "Facturado",
  margin: "Margen",
}

const PURCHASE_SORT_LABELS: Record<string, string> = {
  cost: "Costo de compras",
  articles: "Artículos",
  stockValue: "Valor de stock",
}

const CRITICALITY_LABELS: Record<string, string> = {
  low: "Bajo",
  critical: "Crítico",
  out: "Agotado",
}

const SALES_COLUMNS: Array<ExportColumn<SalesReportRow>> = [
  { header: "Fecha", value: (row) => new Date(row.date), format: "date", width: 14 },
  { header: "Vendedor", value: (row) => row.seller, width: 18 },
  { header: "Artículos", value: (row) => row.units, format: "integer", width: 12 },
  { header: "Total", value: (row) => row.total, format: "money", width: 16 },
  { header: "Pago", value: (row) => row.paymentMethod, width: 16 },
]

const TOP_COLUMNS: Array<ExportColumn<ProductReportRow>> = [
  { header: "Código", value: (row) => row.code ?? "—", width: 12 },
  { header: "Artículo", value: (row) => row.name, width: 30 },
  { header: "Categoría", value: (row) => row.category, width: 18 },
  { header: "Modelo", value: (row) => row.motorcycleModel, width: 16 },
  { header: "Proveedor", value: (row) => row.supplierName ?? "—", width: 20 },
  { header: "Unidades", value: (row) => row.units, format: "integer", width: 12 },
  { header: "Facturado", value: (row) => row.revenue, format: "money", width: 16 },
  { header: "Costo", value: (row) => row.cost, format: "money", width: 16 },
  { header: "Margen", value: (row) => row.margin, format: "money", width: 16 },
  { header: "Margen %", value: (row) => row.marginPct, format: "percent", width: 12 },
]

const LOW_STOCK_COLUMNS: Array<ExportColumn<LowStockReportRow>> = [
  { header: "Proveedor", value: (row) => row.supplierName ?? "Sin proveedor", width: 22 },
  { header: "Código", value: (row) => row.code, width: 12 },
  { header: "Artículo", value: (row) => row.name, width: 30 },
  { header: "Categoría", value: (row) => row.category, width: 18 },
  { header: "Stock", value: (row) => row.stock, format: "integer", width: 10 },
  { header: "Mínimo", value: (row) => row.minStock, format: "integer", width: 10 },
  {
    header: "Criticidad",
    value: (row) => CRITICALITY_LABELS[row.criticality] ?? row.criticality,
    width: 12,
  },
  { header: "Faltante", value: (row) => row.shortage, format: "integer", width: 10 },
  {
    header: "Pedido sugerido",
    value: (row) => row.suggestedOrder,
    format: "integer",
    width: 16,
  },
  { header: "Valor stock", value: (row) => row.stockValue, format: "money", width: 16 },
]

const PURCHASE_COLUMNS: Array<ExportColumn<PurchaseReportRow>> = [
  { header: "Proveedor", value: (row) => row.supplierName, width: 24 },
  { header: "Artículos", value: (row) => row.articles, format: "integer", width: 12 },
  {
    header: "Artículos comprados",
    value: (row) => row.purchasedArticles,
    format: "integer",
    width: 18,
  },
  { header: "Costo compras", value: (row) => row.cost, format: "money", width: 16 },
  { header: "Valor stock", value: (row) => row.stockValue, format: "money", width: 16 },
  { header: "Stock parado", value: (row) => row.idleStockValue, format: "money", width: 16 },
  { header: "Unidades vendidas", value: (row) => row.soldUnits, format: "integer", width: 16 },
  {
    header: "Última compra",
    value: (row) => (row.lastPurchaseAt ? new Date(row.lastPurchaseAt) : ""),
    format: "date",
    width: 16,
  },
]

function parseTab(value: string | null): ReportTab {
  return value === "top" || value === "stock" || value === "compras" ? value : "ventas"
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatNumber(value: number): string {
  return value.toLocaleString("es-AR")
}

function formatDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-")
    return `${day}/${month}/${year}`
  }
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function shortDate(value: string): string {
  const [, month, day] = value.split("-")
  return day && month ? `${day}/${month}` : value
}

function criticalityClass(criticality: string): string {
  if (criticality === "out") return "bg-red-50 text-red-800"
  if (criticality === "critical") return "bg-orange-50 text-orange-800"
  return "bg-yellow-50 text-yellow-800"
}

function KpiCard({
  label,
  value,
  current,
  previous,
}: {
  label: string
  value: string
  current: number
  previous?: number | null
}) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      <Variation current={current} previous={previous} />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
      {text}
    </div>
  )
}

function ReportPagination({
  pagination,
  onPage,
}: {
  pagination: ReportPagination
  onPage: (page: number) => void
}) {
  if (pagination.totalPages <= 1) return null
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
      <span>
        {pagination.total.toLocaleString("es-AR")} fila(s) · página {pagination.page} de{" "}
        {pagination.totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
          className="rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}

function SalesReportView({ report }: { report: SalesReport }) {
  const previous = report.previous?.summary
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Facturado"
          value={formatMoney(report.summary.total)}
          current={report.summary.total}
          previous={previous?.total}
        />
        <KpiCard
          label="Ventas"
          value={formatNumber(report.summary.count)}
          current={report.summary.count}
          previous={previous?.count}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatMoney(report.summary.avgTicket)}
          current={report.summary.avgTicket}
          previous={previous?.avgTicket}
        />
        <KpiCard
          label="Unidades vendidas"
          value={formatNumber(report.summary.units)}
          current={report.summary.units}
          previous={previous?.units}
        />
      </div>

      {report.rows.length === 0 ? (
        <EmptyState text="No hay ventas en el período seleccionado" />
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Vendedor</th>
                <th className="px-3 py-2 text-right">Artículos</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Pago</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">{formatDateTime(row.date)}</td>
                  <td className="px-3 py-2">{row.seller}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(row.units)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(row.total)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                      {row.paymentMethod}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.rows.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Por vendedor</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-1">Vendedor</th>
                  <th className="py-1 text-right">Ventas</th>
                  <th className="py-1 text-right">Artículos</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.groups.bySeller.map((group) => (
                  <tr key={group.userId} className="border-t border-gray-100">
                    <td className="py-1.5">{group.seller}</td>
                    <td className="py-1.5 text-right">{formatNumber(group.count)}</td>
                    <td className="py-1.5 text-right">{formatNumber(group.units)}</td>
                    <td className="py-1.5 text-right">{formatMoney(group.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Por día</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-1">Día</th>
                  <th className="py-1 text-right">Ventas</th>
                  <th className="py-1 text-right">Artículos</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.groups.byDay.map((group) => (
                  <tr key={group.date} className="border-t border-gray-100">
                    <td className="py-1.5">{formatDate(group.date)}</td>
                    <td className="py-1.5 text-right">{formatNumber(group.count)}</td>
                    <td className="py-1.5 text-right">{formatNumber(group.units)}</td>
                    <td className="py-1.5 text-right">{formatMoney(group.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function TopProductsView({ report }: { report: TopProductsReport }) {
  const previous = report.previous?.summary
  const chartRows = report.rows.filter((row) => row.units > 0).slice(0, 10)
  const maxUnits = Math.max(...chartRows.map((row) => row.units), 0)

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Unidades"
          value={formatNumber(report.summary.units)}
          current={report.summary.units}
          previous={previous?.units}
        />
        <KpiCard
          label="Facturado"
          value={formatMoney(report.summary.revenue)}
          current={report.summary.revenue}
          previous={previous?.revenue}
        />
        <KpiCard
          label="Margen estimado"
          value={formatMoney(report.summary.margin)}
          current={report.summary.margin}
          previous={previous?.margin}
        />
        <KpiCard
          label="Productos vendidos"
          value={formatNumber(report.summary.products)}
          current={report.summary.products}
          previous={previous?.products}
        />
      </div>

      {chartRows.length > 0 && (
        <div className="mb-4 rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Top de productos por unidades</h3>
          <div className="space-y-2">
            {chartRows.map((row) => (
              <div key={row.code ?? row.name} className="flex items-center gap-2">
                <span className="w-56 truncate text-sm text-gray-700" title={row.name}>
                  {row.name}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                  <div
                    className="h-4 rounded bg-blue-500"
                    style={{ width: `${Math.max(3, (row.units / maxUnits) * 100)}%` }}
                  />
                </div>
                <span className="w-14 text-right text-sm font-medium">{formatNumber(row.units)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.rows.length === 0 ? (
        <EmptyState text="No hay productos vendidos en el período seleccionado" />
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Artículo</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Modelo</th>
                <th className="px-3 py-2">Proveedor</th>
                <th className="px-3 py-2 text-right">Unidades</th>
                <th className="px-3 py-2 text-right">Facturado</th>
                <th className="px-3 py-2 text-right">Costo</th>
                <th className="px-3 py-2 text-right">Margen</th>
                <th className="px-3 py-2 text-right">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.code ?? `deleted-${row.name}`} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{row.code ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.category}</td>
                  <td className="px-3 py-2">{row.motorcycleModel}</td>
                  <td className="px-3 py-2">{row.supplierName ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(row.units)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.revenue)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.cost)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(row.margin)}</td>
                  <td className="px-3 py-2 text-right">{row.marginPct.toLocaleString("es-AR")}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LowStockView({ report }: { report: LowStockReport }) {
  const groups = new Map<string, LowStockReportRow[]>()
  for (const row of report.rows) {
    const key = row.supplierName ?? "Sin proveedor"
    const rows = groups.get(key) ?? []
    rows.push(row)
    groups.set(key, rows)
  }

  const groupOrder = [
    ...new Set([
      ...report.groups.bySupplier.map((group) => group.supplierName),
      ...groups.keys(),
    ]),
  ]

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Artículos bajo stock"
          value={formatNumber(report.summary.articles)}
          current={report.summary.articles}
        />
        <KpiCard
          label="Críticos"
          value={formatNumber(report.summary.critical)}
          current={report.summary.critical}
        />
        <KpiCard
          label="Agotados"
          value={formatNumber(report.summary.out)}
          current={report.summary.out}
        />
        <KpiCard
          label="Valor del stock bajo"
          value={formatMoney(report.summary.stockValue)}
          current={report.summary.stockValue}
        />
      </div>

      {report.rows.length === 0 ? (
        <EmptyState text="No hay artículos bajo stock con los filtros seleccionados" />
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Artículo</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Modelo</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-right">Mínimo</th>
                <th className="px-3 py-2">Criticidad</th>
                <th className="px-3 py-2 text-right">Faltante</th>
                <th className="px-3 py-2 text-right">Pedido sugerido</th>
                <th className="px-3 py-2 text-right">Valor stock</th>
              </tr>
            </thead>
            {groupOrder.map((supplierName) => {
              const rows = groups.get(supplierName)
              if (!rows || rows.length === 0) return null
              const group = report.groups.bySupplier.find(
                (item) => item.supplierName === supplierName,
              )
              return (
                <tbody key={supplierName}>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={10} className="px-3 py-2 text-xs font-semibold uppercase text-gray-600">
                      {supplierName}
                      {group
                        ? ` · ${group.articles} artículo(s) · ${group.suggestedOrder} unidades sugeridas`
                        : ""}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.code} className={`border-t border-gray-100 ${criticalityClass(row.criticality)}`}>
                      <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2">{row.category}</td>
                      <td className="px-3 py-2">{row.motorcycleModel}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.stock}</td>
                      <td className="px-3 py-2 text-right">{row.minStock}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-white/70 px-2 py-0.5 text-xs font-medium">
                          {CRITICALITY_LABELS[row.criticality] ?? row.criticality}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{row.shortage}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.suggestedOrder}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.stockValue)}</td>
                    </tr>
                  ))}
                </tbody>
              )
            })}
          </table>
        </div>
      )}
    </div>
  )
}

function PurchasesView({ report }: { report: PurchasesReport }) {
  const previous = report.previous?.summary
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Costo de compras"
          value={formatMoney(report.summary.cost)}
          current={report.summary.cost}
          previous={previous?.cost}
        />
        <KpiCard
          label="Artículos comprados"
          value={formatNumber(report.summary.purchasedArticles)}
          current={report.summary.purchasedArticles}
          previous={previous?.purchasedArticles}
        />
        <KpiCard
          label="Valor de inventario"
          value={formatMoney(report.summary.stockValue)}
          current={report.summary.stockValue}
          previous={previous?.stockValue}
        />
        <KpiCard
          label="Stock parado"
          value={formatMoney(report.summary.idleStockValue)}
          current={report.summary.idleStockValue}
          previous={previous?.idleStockValue}
        />
      </div>

      {report.rows.length === 0 ? (
        <EmptyState text="No hay compras de proveedores en el período seleccionado" />
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2">Proveedor</th>
                <th className="px-3 py-2 text-right">Artículos</th>
                <th className="px-3 py-2 text-right">Comprados</th>
                <th className="px-3 py-2 text-right">Costo compras</th>
                <th className="px-3 py-2 text-right">Valor stock</th>
                <th className="px-3 py-2 text-right">Stock parado</th>
                <th className="px-3 py-2 text-right">Unidades vendidas</th>
                <th className="px-3 py-2">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.supplierId ?? row.supplierName} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">{row.supplierName}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(row.articles)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(row.purchasedArticles)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.cost)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.stockValue)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.idleStockValue)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(row.soldUnits)}</td>
                  <td className="px-3 py-2">
                    {row.lastPurchaseAt ? formatDate(row.lastPurchaseAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function pdfData(cells: string[]): PdfTableRow {
  return { kind: "data", cells }
}

function pdfGroup(label: string): PdfTableRow {
  return { kind: "group", label }
}

function pdfRows<T>(
  rows: T[],
  total: number,
): { rows: T[]; truncated?: { shown: number; total: number } } {
  if (rows.length <= PDF_MAX_ROWS) return { rows }
  return {
    rows: rows.slice(0, PDF_MAX_ROWS),
    truncated: { shown: PDF_MAX_ROWS, total },
  }
}

function salesPdfContent(report: SalesReport): PdfReportContent {
  const { rows, truncated } = pdfRows(report.rows, report.pagination.total)
  const previous = report.previous?.summary
  const kpis: PdfKpi[] = [
    {
      label: "Facturado",
      value: formatMoney(report.summary.total),
      current: report.summary.total,
      previous: previous?.total,
    },
    {
      label: "Ventas",
      value: formatNumber(report.summary.count),
      current: report.summary.count,
      previous: previous?.count,
    },
    {
      label: "Ticket promedio",
      value: formatMoney(report.summary.avgTicket),
      current: report.summary.avgTicket,
      previous: previous?.avgTicket,
    },
    {
      label: "Unidades vendidas",
      value: formatNumber(report.summary.units),
      current: report.summary.units,
      previous: previous?.units,
    },
  ]

  const sections: PdfTableSection[] = [
    {
      columns: [
        { header: "Fecha", width: 17 },
        { header: "Vendedor", width: 24 },
        { header: "Artículos", width: 12, align: "right" },
        { header: "Total", width: 16, align: "right" },
        { header: "Pago", width: 14 },
      ],
      rows: rows.map((row) =>
        pdfData([
          formatDateTime(row.date),
          row.seller,
          formatNumber(row.units),
          formatMoney(row.total),
          row.paymentMethod,
        ]),
      ),
      emptyText: "No hay ventas en el período seleccionado",
    },
  ]

  if (report.rows.length > 0) {
    sections.push({
      title: "Por vendedor",
      columns: [
        { header: "Vendedor", width: 30 },
        { header: "Ventas", width: 12, align: "right" },
        { header: "Artículos", width: 12, align: "right" },
        { header: "Total", width: 16, align: "right" },
      ],
      rows: report.groups.bySeller.map((group) =>
        pdfData([
          group.seller,
          formatNumber(group.count),
          formatNumber(group.units),
          formatMoney(group.total),
        ]),
      ),
    })

    sections.push({
      title: "Por día",
      columns: [
        { header: "Día", width: 18 },
        { header: "Ventas", width: 12, align: "right" },
        { header: "Artículos", width: 12, align: "right" },
        { header: "Total", width: 16, align: "right" },
      ],
      rows: report.groups.byDay.map((group) =>
        pdfData([
          formatDate(group.date),
          formatNumber(group.count),
          formatNumber(group.units),
          formatMoney(group.total),
        ]),
      ),
    })
  }

  return { kpis, sections, truncated }
}

function topPdfContent(report: TopProductsReport): PdfReportContent {
  const { rows, truncated } = pdfRows(report.rows, report.pagination.total)
  const previous = report.previous?.summary
  const chartRows = report.rows.filter((row) => row.units > 0).slice(0, 10)
  const chart: PdfChart | undefined =
    chartRows.length > 0
      ? {
          title: "Top de productos por unidades",
          items: chartRows.map((row) => ({ label: row.name, value: row.units })),
        }
      : undefined

  const kpis: PdfKpi[] = [
    {
      label: "Unidades",
      value: formatNumber(report.summary.units),
      current: report.summary.units,
      previous: previous?.units,
    },
    {
      label: "Facturado",
      value: formatMoney(report.summary.revenue),
      current: report.summary.revenue,
      previous: previous?.revenue,
    },
    {
      label: "Margen estimado",
      value: formatMoney(report.summary.margin),
      current: report.summary.margin,
      previous: previous?.margin,
    },
    {
      label: "Productos vendidos",
      value: formatNumber(report.summary.products),
      current: report.summary.products,
      previous: previous?.products,
    },
  ]

  const sections: PdfTableSection[] = [
    {
      columns: [
        { header: "Código", width: 10 },
        { header: "Artículo", width: 30 },
        { header: "Categoría", width: 18 },
        { header: "Modelo", width: 14 },
        { header: "Proveedor", width: 18 },
        { header: "Unidades", width: 10, align: "right" },
        { header: "Facturado", width: 14, align: "right" },
        { header: "Costo", width: 12, align: "right" },
        { header: "Margen", width: 14, align: "right" },
        { header: "Margen %", width: 10, align: "right" },
      ],
      rows: rows.map((row) =>
        pdfData([
          row.code ?? "—",
          row.name,
          row.category,
          row.motorcycleModel,
          row.supplierName ?? "—",
          formatNumber(row.units),
          formatMoney(row.revenue),
          formatMoney(row.cost),
          formatMoney(row.margin),
          `${formatNumber(row.marginPct)}%`,
        ]),
      ),
      emptyText: "No hay productos vendidos en el período seleccionado",
    },
  ]

  return { kpis, chart, sections, truncated }
}

function stockPdfContent(report: LowStockReport): PdfReportContent {
  const { rows, truncated } = pdfRows(report.rows, report.pagination.total)
  const groups = new Map<string, LowStockReportRow[]>()

  for (const row of rows) {
    const key = row.supplierName ?? "Sin proveedor"
    const groupRows = groups.get(key) ?? []
    groupRows.push(row)
    groups.set(key, groupRows)
  }

  const groupOrder = [
    ...new Set([
      ...report.groups.bySupplier.map((group) => group.supplierName),
      ...groups.keys(),
    ]),
  ]

  const body: PdfTableRow[] = []
  for (const supplierName of groupOrder) {
    const groupRows = groups.get(supplierName)
    if (!groupRows || groupRows.length === 0) continue

    const suggested = groupRows.reduce((sum, row) => sum + row.suggestedOrder, 0)
    body.push(
      pdfGroup(
        `${supplierName} - ${groupRows.length} artículo(s) - ${suggested} unidades sugeridas`,
      ),
    )

    for (const row of groupRows) {
      body.push(
        pdfData([
          row.code,
          row.name,
          row.category,
          row.motorcycleModel,
          formatNumber(row.stock),
          formatNumber(row.minStock),
          CRITICALITY_LABELS[row.criticality] ?? row.criticality,
          formatNumber(row.shortage),
          formatNumber(row.suggestedOrder),
          formatMoney(row.stockValue),
        ]),
      )
    }
  }

  const kpis: PdfKpi[] = [
    {
      label: "Artículos bajo stock",
      value: formatNumber(report.summary.articles),
      current: report.summary.articles,
    },
    {
      label: "Críticos",
      value: formatNumber(report.summary.critical),
      current: report.summary.critical,
    },
    {
      label: "Agotados",
      value: formatNumber(report.summary.out),
      current: report.summary.out,
    },
    {
      label: "Valor del stock bajo",
      value: formatMoney(report.summary.stockValue),
      current: report.summary.stockValue,
    },
  ]

  return {
    kpis,
    sections: [
      {
        columns: [
          { header: "Código", width: 10 },
          { header: "Artículo", width: 29 },
          { header: "Categoría", width: 17 },
          { header: "Modelo", width: 14 },
          { header: "Stock", width: 8, align: "right" },
          { header: "Mínimo", width: 8, align: "right" },
          { header: "Criticidad", width: 12 },
          { header: "Faltante", width: 8, align: "right" },
          { header: "Pedido sugerido", width: 12, align: "right" },
          { header: "Valor stock", width: 12, align: "right" },
        ],
        rows: body,
        emptyText: "No hay artículos bajo stock con los filtros seleccionados",
      },
    ],
    truncated,
  }
}

function purchasesPdfContent(report: PurchasesReport): PdfReportContent {
  const { rows, truncated } = pdfRows(report.rows, report.pagination.total)
  const previous = report.previous?.summary
  const kpis: PdfKpi[] = [
    {
      label: "Costo de compras",
      value: formatMoney(report.summary.cost),
      current: report.summary.cost,
      previous: previous?.cost,
    },
    {
      label: "Artículos comprados",
      value: formatNumber(report.summary.purchasedArticles),
      current: report.summary.purchasedArticles,
      previous: previous?.purchasedArticles,
    },
    {
      label: "Valor de inventario",
      value: formatMoney(report.summary.stockValue),
      current: report.summary.stockValue,
      previous: previous?.stockValue,
    },
    {
      label: "Stock parado",
      value: formatMoney(report.summary.idleStockValue),
      current: report.summary.idleStockValue,
      previous: previous?.idleStockValue,
    },
  ]

  return {
    kpis,
    sections: [
      {
        columns: [
          { header: "Proveedor", width: 26 },
          { header: "Artículos", width: 10, align: "right" },
          { header: "Comprados", width: 12, align: "right" },
          { header: "Costo compras", width: 15, align: "right" },
          { header: "Valor stock", width: 15, align: "right" },
          { header: "Stock parado", width: 15, align: "right" },
          { header: "Unidades vendidas", width: 14, align: "right" },
          { header: "Última compra", width: 14 },
        ],
        rows: rows.map((row) =>
          pdfData([
            row.supplierName,
            formatNumber(row.articles),
            formatNumber(row.purchasedArticles),
            formatMoney(row.cost),
            formatMoney(row.stockValue),
            formatMoney(row.idleStockValue),
            formatNumber(row.soldUnits),
            row.lastPurchaseAt ? formatDate(row.lastPurchaseAt) : "—",
          ]),
        ),
        emptyText: "No hay compras de proveedores en el período seleccionado",
      },
    ],
    truncated,
  }
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [defaults] = useState(() => defaultReportRange())
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null)
  const [topReport, setTopReport] = useState<TopProductsReport | null>(null)
  const [stockReport, setStockReport] = useState<LowStockReport | null>(null)
  const [purchasesReport, setPurchasesReport] = useState<PurchasesReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null)

  const tab = parseTab(searchParams.get("tab"))
  const preset = searchParams.get("preset") || "mes-anterior"
  const from = searchParams.get("from") || defaults.from
  const to = searchParams.get("to") || defaults.to
  const compare = searchParams.get("compare") !== "none"
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  const queryKey = searchParams.toString()

  useEffect(() => {
    if (searchParams.get("from") && searchParams.get("to")) return
    const next = new URLSearchParams(searchParams)
    next.set("from", defaults.from)
    next.set("to", defaults.to)
    if (!next.get("preset")) next.set("preset", "mes-anterior")
    setSearchParams(next, { replace: true })
  }, [defaults.from, defaults.to, searchParams, setSearchParams])

  useEffect(() => {
    let cancelled = false
    listSupplierOptions()
      .then((data) => {
        if (!cancelled) setSuppliers(data)
      })
      .catch(() => {
        if (!cancelled) setSuppliers([])
      })
    listUsers()
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch(() => {
        if (!cancelled) setUsers([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  function buildFilters(allRows: boolean): ReportFilters {
    const filters: ReportFilters = {
      from,
      to,
      compareWith: compare ? "previous" : "none",
    }
    if (allRows) {
      filters.all = true
    } else {
      filters.page = page
      filters.limit = PAGE_SIZE
    }

    const raw = filters as Record<string, string | number | boolean>
    for (const key of SPECIFIC_KEYS[tab]) {
      const value = searchParams.get(key)
      if (!value) continue
      if (key === "onlyWithSales" || key === "includeZeroStock" || key === "onlyWithPurchases") {
        raw[key] = value === "true"
      } else {
        raw[key] = value
      }
    }
    return filters
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const filters = buildFilters(false)

    async function load() {
      try {
        if (tab === "ventas") {
          const data = await getSalesReport(filters)
          if (!cancelled) setSalesReport(data)
        } else if (tab === "top") {
          const data = await getTopProductsReport(filters)
          if (!cancelled) setTopReport(data)
        } else if (tab === "stock") {
          const data = await getLowStockReport(filters)
          if (!cancelled) setStockReport(data)
        } else {
          const data = await getPurchasesReport(filters)
          if (!cancelled) setPurchasesReport(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el reporte")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [queryKey, tab])

  const activePeriod =
    tab === "ventas"
      ? salesReport?.period
      : tab === "top"
        ? topReport?.period
        : tab === "stock"
          ? stockReport?.period
          : purchasesReport?.period

  const activePreviousPeriod =
    tab === "ventas"
      ? salesReport?.previousPeriod
      : tab === "top"
        ? topReport?.previousPeriod
        : tab === "stock"
          ? stockReport?.previousPeriod
          : purchasesReport?.previousPeriod

  const activePagination =
    tab === "ventas"
      ? salesReport?.pagination
      : tab === "top"
        ? topReport?.pagination
        : tab === "stock"
          ? stockReport?.pagination
          : purchasesReport?.pagination

  function chipLabel(key: keyof ReportFilters, value: string): string {
    if (key === "userId") {
      return `Vendedor: ${users.find((user) => String(user.id) === value)?.username ?? value}`
    }
    if (key === "paymentMethod") return `Pago: ${value}`
    if (key === "minTotal") return `Total mínimo: ${formatMoney(Number(value))}`
    if (key === "maxTotal") return `Total máximo: ${formatMoney(Number(value))}`
    if (key === "supplierId") {
      return `Proveedor: ${suppliers.find((supplier) => String(supplier.id) === value)?.name ?? value}`
    }
    if (key === "category") return `Categoría: ${value}`
    if (key === "motorcycleModel") return `Modelo: ${value}`
    if (key === "onlyWithSales") {
      return value === "false" ? "Incluye artículos sin ventas" : "Solo con ventas"
    }
    if (key === "criticality") return `Criticidad: ${CRITICALITY_LABELS[value] ?? value}`
    if (key === "includeZeroStock") {
      return value === "false" ? "Excluye agotados" : "Incluye agotados"
    }
    if (key === "onlyWithPurchases") return "Solo con compras"
    if (key === "sortBy") {
      return `Orden: ${
        (tab === "compras" ? PURCHASE_SORT_LABELS : PRODUCT_SORT_LABELS)[value] ?? value
      }`
    }
    return `${key}: ${value}`
  }

  const chips: Array<{ key: string; label: string }> = []
  for (const key of SPECIFIC_KEYS[tab]) {
    const value = searchParams.get(key)
    if (!value) continue
    chips.push({ key, label: chipLabel(key, value) })
  }
  if (compare) chips.push({ key: "compare", label: "Comparando con período anterior" })

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value === "") next.delete(key)
    else next.set(key, value)
    next.delete("page")
    setSearchParams(next)
  }

  function updatePeriod(value: { preset: string; from: string; to: string }) {
    const next = new URLSearchParams(searchParams)
    next.set("preset", value.preset)
    next.set("from", value.from)
    next.set("to", value.to)
    next.delete("page")
    setSearchParams(next)
  }

  function updateCompare(value: boolean) {
    const next = new URLSearchParams(searchParams)
    next.set("compare", value ? "previous" : "none")
    next.delete("page")
    setSearchParams(next)
  }

  function switchTab(nextTab: ReportTab) {
    const next = new URLSearchParams(searchParams)
    next.set("tab", nextTab)
    for (const key of ALL_SPECIFIC_KEYS) next.delete(key)
    next.delete("page")
    setSearchParams(next)
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    for (const key of ALL_SPECIFIC_KEYS) next.delete(key)
    next.set("compare", "none")
    next.delete("page")
    setSearchParams(next)
  }

  function removeChip(key: string) {
    if (key === "compare") {
      updateCompare(false)
      return
    }
    updateFilter(key, "")
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    next.set("page", String(nextPage))
    setSearchParams(next)
  }

  async function handleExportXlsx() {
    setExporting("xlsx")
    setError(null)
    try {
      const filters = buildFilters(true)
      const filterLabels = chips.filter((chip) => chip.key !== "compare").map((chip) => chip.label)

      if (tab === "ventas") {
        const report = await getSalesReport(filters)
        await exportReportXlsx({
          title: "Reporte de ventas",
          sheetName: "Ventas",
          periodLabel: report.period.label,
          filters: filterLabels,
          columns: SALES_COLUMNS,
          rows: report.rows,
          filename: `reporte-ventas-${report.period.from}_${report.period.to}.xlsx`,
        })
      } else if (tab === "top") {
        const report = await getTopProductsReport(filters)
        await exportReportXlsx({
          title: "Reporte de productos más vendidos",
          sheetName: "Más vendidos",
          periodLabel: report.period.label,
          filters: filterLabels,
          columns: TOP_COLUMNS,
          rows: report.rows,
          filename: `reporte-mas-vendidos-${report.period.from}_${report.period.to}.xlsx`,
        })
      } else if (tab === "stock") {
        const report = await getLowStockReport(filters)
        await exportReportXlsx({
          title: "Reporte de artículos bajo stock",
          sheetName: "Bajo stock",
          periodLabel: report.period.label,
          filters: filterLabels,
          columns: LOW_STOCK_COLUMNS,
          rows: report.rows,
          filename: `reporte-bajo-stock-${report.period.from}_${report.period.to}.xlsx`,
        })
      } else {
        const report = await getPurchasesReport(filters)
        await exportReportXlsx({
          title: "Reporte de compras por proveedor",
          sheetName: "Compras",
          periodLabel: report.period.label,
          filters: filterLabels,
          columns: PURCHASE_COLUMNS,
          rows: report.rows,
          filename: `reporte-compras-${report.period.from}_${report.period.to}.xlsx`,
        })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo exportar el reporte")
    } finally {
      setExporting(null)
    }
  }

  async function handleDownloadPdf() {
    setExporting("pdf")
    setError(null)
    try {
      // Deja que el botón muestre "Generando PDF…" antes de bloquear el hilo.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50))
      const filters = buildFilters(true)
      const filenameFilters = chips.map((chip) => ({ key: chip.key, label: chip.label }))

      if (tab === "ventas") {
        const report = await getSalesReport(filters)
        await exportReportPdf({
          ...salesPdfContent(report),
          filename: buildReportFilename({
            tab,
            period: report.period,
            filters: filenameFilters,
          }),
        })
      } else if (tab === "top") {
        const report = await getTopProductsReport(filters)
        await exportReportPdf({
          ...topPdfContent(report),
          filename: buildReportFilename({
            tab,
            period: report.period,
            filters: filenameFilters,
          }),
        })
      } else if (tab === "stock") {
        const report = await getLowStockReport(filters)
        await exportReportPdf({
          ...stockPdfContent(report),
          filename: buildReportFilename({
            tab,
            period: report.period,
            filters: filenameFilters,
          }),
        })
      } else {
        const report = await getPurchasesReport(filters)
        await exportReportPdf({
          ...purchasesPdfContent(report),
          filename: buildReportFilename({
            tab,
            period: report.period,
            filters: filenameFilters,
          }),
        })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo generar el PDF")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-gray-600">
            Ventas, productos, stock y compras con filtros combinables. Sólo administradores.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleExportXlsx()}
            disabled={loading || exporting !== null}
            className="rounded border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            {exporting === "xlsx" ? "Exportando…" : "Exportar XLSX"}
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={loading || exporting !== null}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {exporting === "pdf" ? "Generando PDF…" : "Descargar PDF"}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 rounded border border-gray-200 bg-white p-1">
        {TAB_ORDER.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => switchTab(item)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              tab === item
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {TAB_LABELS[item]}
          </button>
        ))}
      </div>

      <PeriodPicker
        preset={preset}
        from={from}
        to={to}
        compare={compare}
        onChange={updatePeriod}
        onCompareChange={updateCompare}
      />

      <div className="mt-3 flex flex-wrap items-end gap-3">
        {tab === "ventas" && (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Vendedor
              <select
                value={searchParams.get("userId") ?? ""}
                onChange={(event) => updateFilter("userId", event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Tipo de pago
              <select
                value={searchParams.get("paymentMethod") ?? ""}
                onChange={(event) => updateFilter("paymentMethod", event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Total mínimo
              <input
                type="number"
                min="0"
                step="0.01"
                value={searchParams.get("minTotal") ?? ""}
                onChange={(event) => updateFilter("minTotal", event.target.value)}
                className="w-32 rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Total máximo
              <input
                type="number"
                min="0"
                step="0.01"
                value={searchParams.get("maxTotal") ?? ""}
                onChange={(event) => updateFilter("maxTotal", event.target.value)}
                className="w-32 rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </>
        )}

        {(tab === "top" || tab === "stock" || tab === "compras") && (
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Proveedor
            <select
              value={searchParams.get("supplierId") ?? ""}
              onChange={(event) => updateFilter("supplierId", event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {(tab === "top" || tab === "stock") && (
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Categoría
            <input
              type="text"
              value={searchParams.get("category") ?? ""}
              onChange={(event) => updateFilter("category", event.target.value)}
              placeholder="Todas"
              className="w-40 rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {tab === "top" && (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Modelo de moto
              <input
                type="text"
                value={searchParams.get("motorcycleModel") ?? ""}
                onChange={(event) => updateFilter("motorcycleModel", event.target.value)}
                placeholder="Todos"
                className="w-40 rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Ordenar por
              <select
                value={searchParams.get("sortBy") ?? "units"}
                onChange={(event) => updateFilter("sortBy", event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(PRODUCT_SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={searchParams.get("onlyWithSales") !== "false"}
                onChange={(event) =>
                  updateFilter("onlyWithSales", event.target.checked ? "" : "false")
                }
              />
              Solo con ventas
            </label>
          </>
        )}

        {tab === "stock" && (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Criticidad
              <select
                value={searchParams.get("criticality") ?? ""}
                onChange={(event) => updateFilter("criticality", event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                <option value="low">Bajo</option>
                <option value="critical">Crítico</option>
                <option value="out">Agotado</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={searchParams.get("includeZeroStock") !== "false"}
                onChange={(event) =>
                  updateFilter("includeZeroStock", event.target.checked ? "" : "false")
                }
              />
              Incluir agotados
            </label>
          </>
        )}

        {tab === "compras" && (
          <>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Ordenar por
              <select
                value={searchParams.get("sortBy") ?? "cost"}
                onChange={(event) => updateFilter("sortBy", event.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(PURCHASE_SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={searchParams.get("onlyWithPurchases") === "true"}
                onChange={(event) =>
                  updateFilter("onlyWithPurchases", event.target.checked ? "true" : "")
                }
              />
              Solo con compras
            </label>
          </>
        )}
      </div>

      <div className="mt-3 text-sm text-gray-700">
        Mostrando{" "}
        <strong>{activePeriod?.label ?? `${from} – ${to}`}</strong>
        {activePeriod && (
          <span className="text-gray-500">
            {" "}
            ({shortDate(activePeriod.from)} – {shortDate(activePeriod.to)})
          </span>
        )}
        {compare && activePreviousPeriod && (
          <span className="text-gray-600"> · Comparando con {activePreviousPeriod.label}</span>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-gray-500">Filtros activos:</span>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => removeChip(chip.key)}
                aria-label={`Quitar ${chip.label}`}
                className="text-blue-800 hover:text-blue-950"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
          <div className="mt-4 h-56 animate-pulse rounded bg-gray-100" />
        </div>
      ) : (
        <>
          {tab === "ventas" && salesReport && <SalesReportView report={salesReport} />}
          {tab === "top" && topReport && <TopProductsView report={topReport} />}
          {tab === "stock" && stockReport && <LowStockView report={stockReport} />}
          {tab === "compras" && purchasesReport && <PurchasesView report={purchasesReport} />}
        </>
      )}

      {!loading && !error && activePagination && (
        <ReportPagination pagination={activePagination} onPage={setPage} />
      )}
    </div>
  )
}
