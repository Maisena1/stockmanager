import { AUDIT_ACTION_LABELS } from "../lib/audit"
import type { TurnoConResumen } from "../lib/turns"

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

const PAYMENT_ORDER = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"]

export function TurnoResumenModal({
  data,
  onClose,
}: {
  data: TurnoConResumen
  onClose: () => void
}) {
  const { turno, resumen } = data
  const pagos = PAYMENT_ORDER.filter((p) => resumen.ventas.byPayment[p])
  const otrosPagos = Object.keys(resumen.ventas.byPayment).filter(
    (p) => !PAYMENT_ORDER.includes(p),
  )

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-gray-800">Resumen del turno</h2>
        <p className="mb-4 text-sm text-gray-600">
          {turno.user.username} · abierto {formatDateTime(turno.abiertoAt)} ·{" "}
          {turno.cerradoAt ? `cerrado ${formatDateTime(turno.cerradoAt)}` : "en curso"}
        </p>

        <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Total facturado</p>
          <p className="text-2xl font-bold">{formatMoney(resumen.ventas.total)}</p>
          <p className="text-xs text-gray-500">
            {resumen.ventas.count} venta(s) · {resumen.accionesCount} acción(es) registrada(s)
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

        <p className="mb-2 text-sm font-medium text-gray-700">Acciones del turno</p>
        {resumen.acciones.length === 0 ? (
          <p className="mb-4 text-sm text-gray-600">No se registraron acciones en este turno</p>
        ) : (
          <ul className="mb-4 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded border border-gray-200">
            {resumen.acciones.map((a) => (
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
