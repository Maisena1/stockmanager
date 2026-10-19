import { useEffect, useState } from "react"
import { ApiError } from "../lib/api"
import {
  listUsers,
  resetUserCode,
  updateUser,
  type ManagedUser,
} from "../lib/users"
import { UserFormModal } from "../components/UserFormModal"

const ROLE_LABELS: Record<ManagedUser["role"], string> = {
  ADMIN: "Administrador",
  EMPLOYEE: "Empleado",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR")
}

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [deactivating, setDeactivating] = useState<ManagedUser | null>(null)
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setUsers(await listUsers())
    } catch (e) {
      setUsers([])
      setError(e instanceof ApiError ? e.message : "No se pudo cargar la lista de usuarios")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    listUsers()
      .then((data) => {
        if (cancelled) return
        setUsers(data)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setUsers([])
        setError(e instanceof ApiError ? e.message : "No se pudo cargar la lista de usuarios")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(user: ManagedUser) {
    setEditing(user)
    setFormOpen(true)
  }

  async function confirmDeactivate() {
    if (!deactivating) return
    setWorking(true)
    setActionError(null)
    try {
      await updateUser(deactivating.id, { active: false })
      setDeactivating(null)
      await reload()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "No se pudo desactivar el usuario")
    } finally {
      setWorking(false)
    }
  }

  async function activate(user: ManagedUser) {
    setWorking(true)
    setActionError(null)
    try {
      await updateUser(user.id, { active: true })
      await reload()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "No se pudo activar el usuario")
    } finally {
      setWorking(false)
    }
  }

  async function confirmReset() {
    if (!resetTarget) return
    setWorking(true)
    setActionError(null)
    try {
      const result = await resetUserCode(resetTarget.id)
      setResetTarget(null)
      setNewCode(result.code)
      await reload()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "No se pudo resetear el código")
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-gray-600">
            Alta, edición, códigos de acceso y bajas lógicas. Los usuarios inactivos no pueden
            iniciar sesión.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nuevo usuario
        </button>
      </div>

      {actionError && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}
      {loading && <p className="text-sm text-gray-600">Cargando usuarios…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && users.length === 0 && (
        <p className="text-sm text-gray-600">No hay usuarios cargados</p>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Fecha de alta</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{user.id}</td>
                  <td className="px-3 py-2 font-medium">
                    {user.username}
                    {user.phone && (
                      <span className="block text-xs font-normal text-gray-500">{user.phone}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{ROLE_LABELS[user.role]}</td>
                  <td className="px-3 py-2">
                    {user.active ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Activo
                      </span>
                    ) : (
                      <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(user.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="mr-2 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null)
                        setResetTarget(user)
                      }}
                      className="mr-2 rounded border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                    >
                      Resetear código
                    </button>
                    {user.active ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null)
                          setDeactivating(user)
                        }}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void activate(user)}
                        disabled={working}
                        className="rounded border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                      >
                        Activar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <UserFormModal
          user={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            void reload()
          }}
        />
      )}

      {deactivating && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded bg-white p-6">
            <h2 className="mb-2 text-lg font-bold">Desactivar usuario</h2>
            <p className="mb-4 text-sm text-gray-700">
              ¿Desactivar a <strong>{deactivating.username}</strong>? No podrá iniciar sesión,
              pero su historial de ventas y auditoría se conserva.
            </p>
            {actionError && (
              <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeactivating(null)}
                disabled={working}
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDeactivate()}
                disabled={working}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {working ? "Desactivando…" : "Desactivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded bg-white p-6">
            <h2 className="mb-2 text-lg font-bold">Resetear código de acceso</h2>
            <p className="mb-4 text-sm text-gray-700">
              ¿Generar un código nuevo para <strong>{resetTarget.username}</strong>? El código
              actual dejará de funcionar y el nuevo se mostrará una sola vez.
            </p>
            {actionError && (
              <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                disabled={working}
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmReset()}
                disabled={working}
                className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {working ? "Generando…" : "Resetear código"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newCode && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded bg-white p-6">
            <h2 className="mb-2 text-lg font-bold">Código de acceso nuevo</h2>
            <p className="mb-3 text-sm text-gray-700">
              Entregá este código al usuario. No se volverá a mostrar.
            </p>
            <p className="mb-4 rounded border border-gray-300 bg-gray-50 px-4 py-3 text-center font-mono text-xl font-bold tracking-widest">
              {newCode}
            </p>
            <button
              type="button"
              onClick={() => setNewCode(null)}
              className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
