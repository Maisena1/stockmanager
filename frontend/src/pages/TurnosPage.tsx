import { useEffect, useState } from "react"
import { ApiError } from "../lib/api"
import { TurnoResumenModal } from "../components/TurnoResumenModal"
import {
  closeTurno,
  getTurno,
  listTurnos,
  type Turno,
  type TurnoConResumen,
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

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback
}

export default function TurnosPage() {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<TurnoConResumen | null>(null)
  const [aCerrar, setACerrar] = useState<Turno | null>(null)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    listTurnos()
      .then((data) => {
        if (!cancelled) setTurnos(data)
      })
      .catch((e) => {
        if (cancelled) return
        setTurnos([])
        setError(errorMessage(e, "No se pudieron cargar los turnos"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  function refresh() {
    setLoading(true)
    setError(null)
    setReload((n) => n + 1)
  }

  async function verResumen(id: number) {
    setBusy(true)
    setError(null)
    try {
      setModal(await getTurno(id))
    } catch (e) {
      setError(errorMessage(e, "No se pudo cargar el resumen"))
    } finally {
      setBusy(false)
    }
  }

  async function cerrarTurno() {
    if (!aCerrar) return
    setBusy(true)
    setError(null)
    try {
      const data = await closeTurno(aCerrar.id)
      setACerrar(null)
      setModal(data)
      refresh()
    } catch (e) {
      setACerrar(null)
      setError(errorMessage(e, "No se pudo cerrar el turno"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Turnos</h1>
      <p className="mb-4 text-sm text-gray-600">
        Historial de turnos. El administrador ve todos; cada usuario ve los suyos.
      </p>

      {loading && <p className="text-sm text-gray-600">Cargando turnos…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && turnos.length === 0 && !error && (
        <p className="text-sm text-gray-600">Todavía no hay turnos registrados</p>
      )}

      {!loading && turnos.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Apertura</th>
                <th className="px-3 py-2">Cierre</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">{t.id}</td>
                  <td className="px-3 py-2">
                    {t.user.username}
                    <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-600">
                      {t.user.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(t.abiertoAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {t.cerradoAt ? formatDateTime(t.cerradoAt) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {t.cerradoAt ? (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Cerrado
                      </span>
                    ) : (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Abierto
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => verResumen(t.id)}
                      disabled={busy}
                      className="mr-2 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
                    >
                      Resumen
                    </button>
                    {!t.cerradoAt && (
                      <button
                        type="button"
                        onClick={() => setACerrar(t)}
                        disabled={busy}
                        className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Cerrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aCerrar && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-gray-800">¿Cerrar el turno?</h2>
            <p className="mb-4 text-sm text-gray-600">
              Se cerrará el turno de <strong>{aCerrar.user.username}</strong> y se generará un
              resumen de sus ventas y acciones.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setACerrar(null)}
                className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={cerrarTurno}
                disabled={busy}
                className="flex-1 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Cerrando…" : "Cerrar turno"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && <TurnoResumenModal data={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
