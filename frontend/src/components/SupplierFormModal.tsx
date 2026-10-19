import { useState } from "react"
import { ApiError } from "../lib/api"
import {
  createSupplier,
  updateSupplier,
  type Supplier,
  type SupplierInput,
} from "../lib/suppliers"

interface Props {
  supplier: Supplier | null
  onClose: () => void
  onSaved: () => void
}

export function SupplierFormModal({ supplier, onClose, onSaved }: Props) {
  const isEdit = supplier !== null
  const [name, setName] = useState(supplier?.name ?? "")
  const [phone, setPhone] = useState(supplier?.phone ?? "")
  const [email, setEmail] = useState(supplier?.email ?? "")
  const [notes, setNotes] = useState(supplier?.notes ?? "")
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName) {
      setFormError("El nombre del proveedor es obligatorio")
      return
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError("El email no tiene un formato válido")
      return
    }

    const data: SupplierInput = {
      name: trimmedName,
      phone: phone.trim() || null,
      email: trimmedEmail || null,
      notes: notes.trim() || null,
    }

    setSaving(true)
    try {
      if (isEdit && supplier) {
        await updateSupplier(supplier.id, data)
      } else {
        await createSupplier(data)
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
        <h2 className="mb-4 text-xl font-bold">
          {isEdit ? `Editar proveedor ${supplier.name}` : "Nuevo proveedor"}
        </h2>

        {formError && (
          <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-sm">
            Nombre *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Teléfono
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="text-sm">
            Contacto / notas
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
