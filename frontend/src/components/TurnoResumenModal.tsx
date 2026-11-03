import { useState } from "react"
import { AUDIT_ACTION_LABELS } from "../lib/audit"
import type {
  PaymentMethod,
  ResumenVenta,
  TurnoConResumen,
} from "../lib/turns"

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString("es-AR")}`
}

const PAYMENT_ORDER: PaymentMethod[] = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"]

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
}

type Tab = "ventas" | "acciones"
type FiltroPago = "TODOS" | PaymentMethod

export function TurnoResumenModal({
  data,
  onClose,
}: {
  data: TurnoConResumen
  onClose: () => void
}) {
  const { turno, resumen } = data
  const [tab, setTab] = useState<Tab>("ventas")
  const [filtroPago, setFiltroPago] = useState<FiltroPago>("TODOS")
  const [expandida, setExpandida] = useState<number | null>(null)

  const pagos = PAYMENT_ORDER.filter((p) => resumen.ventas.byPayment[p])
  const otrosPagos = Object.keys(resumen.ventas.byPayment).filter(
    (p) => !PAYMENT_ORDER.includes(p as PaymentMethod),
  )

  // En "Acciones" mostramos sólo lo que no es venta: las ventas ya tienen su
  // propia pestaña y su detalle, así no quedan duplicadas.
  const acciones = resumen.acciones.filter((a) => a.action !== "VENTA")
  const ventasFiltradas =
    filtroPago === "TODOS"
      ? resumen.ventasDetalle
      : resumen.ventasDetalle.filter((v) => v.paymentMethod === filtroPago)

  function unidades(venta: ResumenVenta): number {
    return venta.items.reduce((n, item) => n + item.quantity, 0)
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-gray-800">Resumen del turno</h2>
        <p className="mb-4 text-sm text-gray-600">
          {turno.user.username} · abierto {formatDateTime(turno.abiertoAt)} ·{" "}
          {turno.cerradoAt ? `cerrado ${formatDateTime(turno.cerradoAt)}` : "en curso"}
        </p>

        <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Total facturado</p>
          <p className="text-2xl font-bold">{formatMoney(resumen.ventas.total)}</p>
          <p className="text-xs text-gray-500">
            {resumen.ventas.count} venta(s) · {acciones.length} acción(es)
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            {[...pagos, ...otrosPagos].map((p) => (
              <div key={p} className="rounded border border-gray-200 bg-white px-3 py-2">
                <p className="text-xs text-gray-500">{p}</p>
                <p className="text-sm font-semibold">
                  {formatMoney(resumen.ventas.byPayment[p].total)}
                </p>
                <p className="text-xs text-gray-500">
                  {resumen.ventas.byPayment[p].count} venta(s)
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-3 flex rounded border border-gray-200 p-1">
          <button
            type="button"
            onClick={() => setTab("ventas")}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${
              tab === "ventas"
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Ventas ({resumen.ventas.count})
          </button>
          <button
            type="button"
            onClick={() => setTab("acciones")}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${
              tab === "acciones"
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Acciones ({acciones.length})
          </button>
        </div>

        {tab === "ventas" && (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltroPago("TODOS")}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  filtroPago === "TODOS"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Todas ({resumen.ventas.count})
              </button>
              {pagos.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFiltroPago(p)}
                  className={`rounded px-3 py-1 text-xs font-medium ${
                    filtroPago === p
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {PAYMENT_LABELS[p]} ({resumen.ventas.byPayment[p].count})
                </button>
              ))}
              {otrosPagos.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFiltroPago(p as FiltroPago)}
                  className={`rounded px-3 py-1 text-xs font-medium ${
                    filtroPago === p
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {p} ({resumen.ventas.byPayment[p].count})
                </button>
              ))}
            </div>

            {ventasFiltradas.length === 0 ? (
              <p className="mb-4 text-sm text-gray-600">
                No hay ventas con este filtro
              </p>
            ) : (
              <ul className="mb-4 divide-y divide-gray-100 rounded border border-gray-200">
                {ventasFiltradas.map((venta) => (
                  <li key={venta.id} className="bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandida((id) => (id === venta.id ? null : venta.id))
                      }
                      aria-expanded={expandida === venta.id}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium text-gray-800">
                        Venta #{venta.id}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(venta.createdAt)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {unidades(venta)} artículo(s)
                      </span>
                      <span className="text-xs text-gray-500">
                        {PAYMENT_LABELS[venta.paymentMethod] ?? venta.paymentMethod}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {formatMoney(venta.total)}
                      </span>
                    </button>
                    {expandida === venta.id && (
                      <div className="bg-gray-50 px-6 py-3">
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
                            {venta.items.map((item) => (
                              <tr key={item.id}>
                                <td className="py-1 pr-3 text-gray-700">
                                  {item.articleName}
                                </td>
                                <td className="py-1 pr-3 text-right text-gray-700">
                                  {item.quantity}
                                </td>
                                <td className="py-1 pr-3 text-right text-gray-700">
                                  {formatMoney(item.unitPrice)}
                                </td>
                                <td className="py-1 text-right font-medium text-gray-800">
                                  {formatMoney(item.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "acciones" && (
          <>
            <p className="mb-2 text-sm font-medium text-gray-700">Acciones del turno</p>
            {acciones.length === 0 ? (
              <p className="mb-4 text-sm text-gray-600">
                No se registraron acciones en este turno
              </p>
            ) : (
              <ul className="mb-4 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded border border-gray-200">
                {acciones.map((a) => (
                  <li key={a.id} className="px-3 py-2 text-sm">
                    <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {AUDIT_ACTION_LABELS[a.action] ?? a.action}
                    </span>
                    <span className="text-gray-700">{a.detail}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {formatDateTime(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Aceptar
        </button>
      </div>
    </div>
  )
}
