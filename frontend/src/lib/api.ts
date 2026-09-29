const TOKEN_KEY = "stockmanager_token"

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown = undefined) {
    super(message)
    this.status = status
    this.body = body
  }
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }

  // Con FormData el Content-Type lo tiene que poner el browser: si lo forzamos
  // a application/json se pierde el boundary y multer no parsea el archivo.
  if (!isFormData(options.body)) {
    headers["Content-Type"] = "application/json"
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, { ...options, headers })

  if (res.status === 401) {
    setToken(null)
    if (window.location.pathname !== "/login") {
      window.location.href = "/login"
    }
    throw new ApiError("No autenticado", 401)
  }

  if (!res.ok) {
    let message = "Error inesperado"
    let body: unknown
    try {
      body = await res.json()
      const parsed = body as { error?: string } | null
      if (parsed?.error) message = parsed.error
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, body)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** multipart/form-data: config y sheets deben ir antes de file (multer). */
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
}
