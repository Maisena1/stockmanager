import { useEffect, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { api } from "../lib/api"

function navClass({ isActive }: { isActive: boolean }) {
  return `block px-3 py-2 rounded text-sm font-medium ${
    isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"
  }`
}

export function Layout() {
  const { user, loginAt, token, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

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

  const sessionSince = loginAt
    ? new Date(loginAt).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

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
      {user?.role === "ADMIN" && (
        <NavLink to="/import" className={navClass}>
          Importar
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
            {user?.role === "ADMIN" && loginAt && (
              <span className="hidden text-xs text-gray-500 lg:inline">
                Sesión activa desde {sessionSince}
              </span>
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
    </div>
  )
}