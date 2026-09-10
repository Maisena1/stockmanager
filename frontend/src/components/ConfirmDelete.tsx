import { useState } from "react"
import { ApiError } from "../lib/api"
import { deleteArticle } from "../lib/articles"

interface Props {
  code: string
  name: string
  onCancel: () => void
  onDeleted: () => void
}

export function ConfirmDelete({ code, name, onCancel, onDeleted }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setError(null)
    setDeleting(true)
    try {
      await deleteArticle(code)
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar")
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded bg-white p-6">
        <h2 className="mb-2 text-lg font-bold">Eliminar artículo</h2>
        <p className="mb-4 text-sm text-gray-700">
          ¿Eliminar <strong>{code}</strong> ({name})? Esta acción no se puede deshacer.
        </p>
        {error && (
          <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  )
}
