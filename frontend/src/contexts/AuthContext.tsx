import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { api, getToken, setToken } from "../lib/api"

export type Role = "ADMIN" | "EMPLOYEE"

interface User {
  role: Role
  username: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (codigo: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface LoginResponse {
  token: string
  role: Role
  username: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(getToken())
  const [loading, setLoading] = useState(Boolean(getToken()))

  useEffect(() => {
    if (!token) return
    let cancelled = false

    api
      .get<User>("/auth/me")
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null)
          setToken(null)
          setTokenState(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  async function login(codigo: string) {
    const res = await api.post<LoginResponse>("/auth/login", { codigo })
    setToken(res.token)
    setTokenState(res.token)
    setUser({ role: res.role, username: res.username })
  }

  async function logout() {
    try {
      if (token) await api.post("/auth/logout")
    } catch {
      /* la sesión puede ya no existir; igual limpiamos local */
    }
    setToken(null)
    setTokenState(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}
