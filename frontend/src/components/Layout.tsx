import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

function navClass({ isActive }: { isActive: boolean }) {
  return `px-3 py-2 rounded text-sm font-medium ${
    isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"
  }`
}

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout().then(() => navigate("/login"))
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1">
            <NavLink to="/" className="mr-4 text-lg font-bold text-gray-800">
              StockManager
            </NavLink>
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
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user?.username}</span>
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {user?.role}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cerrar sesión
            </button>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
