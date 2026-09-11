import { Fragment, useEffect, useState } from "react"
import { ApiError } from "../lib/api"
import {
  getBalance,
  listSales,
  type Balance,
  type DateRange,
  type Sale,
} from "../lib/sales"

function todayLocal(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString("es-AR")}`
}

const PAYMENT_ORDER = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"]

export default function HistoryPage() {
  const initial = todayLocal()
  const [from, setFrom] = useState(initial)
  const [to, setTo] = useState(initial)
  const [applied, setApplied] = useState<DateRange>({ from: initial, to: initial })
  const [sales, setSales] = useState<Sale[]>([])
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listSales(applied), getBalance(applied)])
      .then(([salesData, balanceData]) => {
        if (cancelled) return
        setSales(salesData)
        setBalance(balanceData)
      })
      .catch((e) => {
        if (cancelled) return
        setSales([])
        setBalance(null)
        setError(e instanceof ApiError ? e.message : "No se pudo cargar")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applied])

  function applyFilters() {
    setLoading(true)
    setError(null)
    setExpanded(null)
    setApplied({ from: from || undefined, to: to || undefined })
  }

  function clearFilters() {
    setFrom("")
    setTo("")
    setLoading(true)
    setError(null)
    setExpanded(null)
    setApplied({})
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Historial de Ventas</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-2 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={applyFilters}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Aplicar filtros
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
        >
          Limpiar filtros
        </button>
      </div>

      {loading && <p className="text-sm text-gray-600">Cargando ventas…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && balance && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="rounded border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Total facturado</p>
            <p className="text-xl font-bold">{formatMoney(balance.total)}</p>
            <p className="text-xs text-gray-500">{balance.count} ventas</p>
          </div>
          {PAYMENT_ORDER.filter((p) => balance.byPayment[p]).map((p) => (
            <div key={p} className="rounded border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{p}</p>
              <p className="text-lg font-semibold">
                {formatMoney(balance.byPayment[p].total)}
              </p>
              <p className="text-xs text-gray-500">{balance.byPayment[p].count} ventas</p>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && sales.length === 0 && (
        <p className="text-sm text-gray-600">No hay ventas en este período</p>
      )}

      {!loading && !error && sales.length > 0 && (
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
              {sales.map((s) => (
                <Fragment key={s.id}>
                  <tr
                    onClick={() => setExpanded((id) => (id === s.id ? null : s.id))}
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">{formatDate(s.createdAt)}</td>
                    <td className="px-3 py-2">{s.user.username}</td>
                    <td className="px-3 py-2 text-right">
                      {s.items.reduce((n, i) => n + i.quantity, 0)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatMoney(s.total)}</td>
                    <td className="px-3 py-2">{s.paymentMethod}</td>
                  </tr>
                  {expanded === s.id && (
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td colSpan={5} className="px-6 py-3">
                        <table className="w-full text-left text-sm">
                          <thead className="text-gray-600">
                            <tr>
                              <th className="py-1 pr-3">Artículo</th>
                              <th className="py-1 pr-3 text-right">Cant.</th>
                              <th className="py-1 pr-3 text-right">Unitario</th>
                              <th className="py-1 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.items.map((i) => (
                              <tr key={i.id}>
                                <td className="py-1 pr-3">{i.article.name}</td>
                                <td className="py-1 pr-3 text-right">{i.quantity}</td>
                                <td className="py-1 pr-3 text-right">
                                  {formatMoney(i.unitPrice)}
                                </td>
                                <td className="py-1 text-right">{formatMoney(i.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
