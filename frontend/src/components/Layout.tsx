import { useEffect, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { api, ApiError } from "../lib/api"
import {
  closeTurno,
  getActiveTurno,
  type Turno,
  type TurnoConResumen,
} from "../lib/turns"
import { TurnoResumenModal } from "./TurnoResumenModal"

function navClass({ isActive }: { isActive: boolean }) {
  return `block px-3 py-2 rounded text-sm font-medium ${
    isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"
  }`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function Layout() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  const [resumenTurno, setResumenTurno] = useState<TurnoConResumen | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null)
  const [turnoCargado, setTurnoCargado] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function cargarTurnoActivo() {
      try {
        const turno = await getActiveTurno()
        if (!cancelled) {
          setTurnoActivo(turno)
          setTurnoCargado(true)
        }
      } catch {
        // Si falla, dejamos el último estado que hubo: la próxima consulta/poll
        // o el regreso a la pestaña lo sincronizan de nuevo.
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void cargarTurnoActivo()
    }
    function onTurnoActualizado() {
      void cargarTurnoActivo()
    }

    void cargarTurnoActivo()
    const interval = setInterval(() => {
      void cargarTurnoActivo()
    }, 30_000)
    window.addEventListener("turno-actualizado", onTurnoActualizado)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener("turno-actualizado", onTurnoActualizado)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [user, token])

  useEffect(() => {
    if (user?.role !== "ADMIN") return

    const interval = setInterval(() => {
      api.post("/auth/heartbeat").catch(() => {
        /* 401 ya redirige a /login */
      })
    }, 30_000)

    return () => clearInterval(interval)
  }, [user?.role, token])

  function handleLogout() {
    logout().then(() => navigate("/login"))
  }

  async function confirmarCerrarTurno() {
    setCerrando(true)
    setErrorCierre(null)
    try {
      const data = await closeTurno()
      setConfirmarCierre(false)
      setResumenTurno(data)
      setTurnoActivo(data.turno.cerradoAt ? null : data.turno)
    } catch (e) {
      setErrorCierre(e instanceof ApiError ? e.message : "No se pudo cerrar el turno")
    } finally {
      setCerrando(false)
    }
  }

  const turnoAbiertoDesde = turnoActivo ? formatTime(turnoActivo.abiertoAt) : null

  const links = (
    <>
      <NavLink to="/articles" className={navClass}>
        Artículos
      </NavLink>
      <NavLink to="/pos" className={navClass}>
        Venta
      </NavLink>
      <NavLink to="/history" className={navClass}>
        Historial
      </NavLink>
      <NavLink to="/turns" className={navClass}>
        Turnos
      </NavLink>
      {user?.role === "ADMIN" && (
        <NavLink to="/reports" className={navClass}>
          Reportes
        </NavLink>
      )}
      {user?.role === "ADMIN" && (
        <NavLink to="/suppliers" className={navClass}>
          Proveedores
        </NavLink>
      )}
      {user?.role === "ADMIN" && (
        <NavLink to="/import" className={navClass}>
          Importar
        </NavLink>
      )}
      {user?.role === "ADMIN" && (
        <NavLink to="/users" className={navClass}>
          Usuarios
        </NavLink>
      )}
      {user?.role === "ADMIN" && (
        <NavLink to="/audit" className={navClass}>
          Registro
        </NavLink>
      )}
    </>
  )

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1">
            <NavLink to="/" className="mr-4 text-lg font-bold text-gray-800">
              StockManager
            </NavLink>
            <div className="hidden items-center gap-1 md:flex">{links}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">
              {user?.username}
            </span>
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {user?.role}
            </span>
            {user && (
              <span className="hidden text-xs text-gray-500 lg:inline">
                {turnoActivo
                  ? `Turno abierto desde ${turnoAbiertoDesde}`
                  : turnoCargado
                    ? "Sin turno abierto"
                    : "Cargando turno…"}
              </span>
            )}
            {turnoActivo && (
              <button
                type="button"
                onClick={() => {
                  setErrorCierre(null)
                  setConfirmarCierre(true)
                }}
                className="rounded border border-blue-600 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                Cerrar turno
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
            >
              {user?.role === "ADMIN" ? "Desconectar" : "Cerrar sesión"}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded border border-gray-300 p-2 text-gray-700 md:hidden"
              aria-label="Menú"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                {menuOpen ? (
                  <path d="M6 6l12 12M6 18L18 6" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </nav>
        {menuOpen && (
          <div className="border-t border-gray-200 px-4 py-2 md:hidden">
            <div className="flex flex-col gap-1">{links}</div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4">
        <Outlet />
      </main>

      {confirmarCierre && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-gray-800">¿Cerrar turno?</h2>
            <p className="mb-4 text-sm text-gray-600">
              Se cerrará tu turno actual y se generará un resumen de las ventas y acciones
              realizadas.
            </p>
            {errorCierre && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {errorCierre}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmarCierre(false)}
                disabled={cerrando}
                className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarCerrarTurno}
                disabled={cerrando}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {cerrando ? "Cerrando…" : "Cerrar turno"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resumenTurno && (
        <TurnoResumenModal data={resumenTurno} onClose={() => setResumenTurno(null)} />
      )}
    </div>
  )
}