import { Link, Navigate, useLocation } from "react-router-dom"
import { useAuth, type Role } from "../contexts/AuthContext"

interface ProtectedRouteProps {
  roles?: Role[]
  children: React.ReactNode
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="p-6">
        <h1 className="mb-2 text-2xl font-bold">No tenés permisos</h1>
        <p className="mb-4 text-sm text-gray-600">
          Esta sección es sólo para administradores.
        </p>
        <Link
          to="/"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Volver al inicio
        </Link>
      </div>
    )
  }

  return children
}
