import { useEffect, useState } from "react"
import { ApiError } from "../lib/api"
import {
  AUDIT_ACTION_LABELS,
  listAudit,
  listAuditUsers,
  type AuditAction,
  type AuditEntry,
  type AuditParams,
  type AuditUser,
} from "../lib/audit"

const ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AuditPage() {
  const [users, setUsers] = useState<AuditUser[]>([])
  const [items, setItems] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [userId, setUserId] = useState("")
  const [action, setAction] = useState("")
  const [applied, setApplied] = useState<AuditParams>({})

  useEffect(() => {
    listAuditUsers()
      .then(setUsers)
      .catch(() => {
        /* el 401 ya redirige; el combo queda vacío y el filtro sigue funcionando */
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    listAudit(applied)
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
        setPage(res.page)
        setPageSize(res.pageSize)
      })
      .catch((e) => {
        if (cancelled) return
        setItems([])
        setTotal(0)
        setError(e instanceof ApiError ? e.message : "No se pudo cargar el registro")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applied])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function applyFilters() {
    setLoading(true)
    setError(null)
    setApplied({
      from: from || undefined,
      to: to || undefined,
      userId: userId ? Number(userId) : undefined,
      action: (action || undefined) as AuditAction | undefined,
      page: 1,
    })
  }

  function clearFilters() {
    setFrom("")
    setTo("")
    setUserId("")
    setAction("")
    setLoading(true)
    setError(null)
    setApplied({ page: 1 })
  }

  function goToPage(next: number) {
    setLoading(true)
    setError(null)
    setApplied((prev) => ({ ...prev, page: next }))
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Registro de acciones</h1>
      <p className="mb-4 text-sm text-gray-600">
        Auditoría de ventas, importaciones y cambios de artículos. Visible sólo para el
        administrador.
      </p>

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
        <label className="text-sm">
          Usuario
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="ml-2 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.role})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Acción
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="ml-2 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a]}
              </option>
            ))}
          </select>
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

      {loading && <p className="text-sm text-gray-600">Cargando registro…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-gray-600">No hay acciones registradas con estos filtros</p>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Acción</th>
                  <th className="px-3 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      {entry.user.username}
                      <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-600">
                        {entry.user.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {AUDIT_ACTION_LABELS[entry.action]}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <span>
              {total} registro(s) — página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
