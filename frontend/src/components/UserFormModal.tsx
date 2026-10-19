import { useState } from "react"
import { ApiError } from "../lib/api"
import {
  createUser,
  updateUser,
  type ManagedUser,
  type UserRole,
} from "../lib/users"

interface Props {
  user: ManagedUser | null
  onClose: () => void
  onSaved: () => void
}

export function UserFormModal({ user, onClose, onSaved }: Props) {
  const isEdit = user !== null
  const [username, setUsername] = useState(user?.username ?? "")
  const [code, setCode] = useState("")
  const [role, setRole] = useState<UserRole>(user?.role ?? "EMPLOYEE")
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [notes, setNotes] = useState(user?.notes ?? "")
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      setFormError("El nombre de usuario es obligatorio")
      return
    }
    if (!isEdit && !code.trim()) {
      setFormError("El código de acceso es obligatorio")
      return
    }

    setSaving(true)
    try {
      if (isEdit && user) {
        await updateUser(user.id, {
          username: trimmedUsername,
          role,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
        })
      } else {
        await createUser({
          username: trimmedUsername,
          code: code.trim(),
          role,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
        })
      }
      onSaved()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full rounded border border-gray-300 px-3 py-2 text-sm"

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded bg-white p-6">
        <h2 className="mb-1 text-xl font-bold">
          {isEdit ? `Editar usuario ${user.username}` : "Nuevo usuario"}
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          {isEdit
            ? "El código de acceso no se muestra: usá «Resetear código» si el usuario lo olvidó."
            : "El administrador define el código de acceso inicial."}
        </p>

        {formError && (
          <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-sm">
            Usuario *
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </label>

          {!isEdit && (
            <label className="text-sm">
              Código de acceso *
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={inputClass}
                autoComplete="off"
              />
            </label>
          )}

          <label className="text-sm">
            Rol *
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={inputClass}
            >
              <option value="EMPLOYEE">Empleado</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>

          <label className="text-sm">
            Teléfono (opcional)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="text-sm">
            Notas (opcional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
