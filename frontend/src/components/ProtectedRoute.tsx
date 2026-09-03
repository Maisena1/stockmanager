import { Navigate, useLocation } from "react-router-dom"
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
    return <Navigate to="/" replace />
  }

  return children
}
