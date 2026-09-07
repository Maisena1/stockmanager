import { useState, type FormEvent } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { ApiError } from "../lib/api"

function errorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Por favor ingrese un código"
    case 401:
      return "Código inválido. Verifique e intente nuevamente"
    case 409:
      return "Ya hay una sesión de administrador activa. Espera a que se desconecte o contacta al administrador"
    default:
      return "Error inesperado. Intente nuevamente"
  }
}

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [codigo, setCodigo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    const destino = user.role === "ADMIN" ? "/" : "/pos"
    return <Navigate to={destino} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!codigo.trim()) {
      setError("Por favor ingrese un código")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const role = await login(codigo.trim())
      navigate(role === "ADMIN" ? "/" : "/pos", { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(errorMessage(err.status))
      } else {
        setError("Error inesperado. Intente nuevamente")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          StockManager
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="codigo" className="text-sm font-medium text-gray-700">
              Código de acceso
            </label>
            <input
              id="codigo"
              type="password"
              autoFocus
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Ingresá tu código"
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {submitting ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  )
}
