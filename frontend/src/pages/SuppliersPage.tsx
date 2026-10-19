import { useEffect, useState } from "react"
import { ApiError } from "../lib/api"
import {
  deleteSupplier,
  getSupplierImpact,
  listSuppliers,
  type Supplier,
  type SupplierImpact,
} from "../lib/suppliers"
import { SupplierFormModal } from "../components/SupplierFormModal"

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState<Supplier | null>(null)
  const [impact, setImpact] = useState<SupplierImpact | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [confirmStep, setConfirmStep] = useState(1)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let cancelled = false
    listSuppliers()
      .then((data) => {
        if (cancelled) return
        setSuppliers(data)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setSuppliers([])
        setError(e instanceof ApiError ? e.message : "No se pudo cargar la lista de proveedores")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setSuppliers(await listSuppliers())
    } catch (e) {
      setSuppliers([])
      setError(e instanceof ApiError ? e.message : "No se pudo cargar la lista de proveedores")
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier)
    setFormOpen(true)
  }

  function openDelete(supplier: Supplier) {
    setDeleting(supplier)
    setImpact(null)
    setImpactLoading(true)
    setConfirmStep(1)
    setDeleteError(null)
    getSupplierImpact(supplier.id)
      .then(setImpact)
      .catch((e) => {
        setDeleteError(e instanceof ApiError ? e.message : "No se pudo calcular el impacto")
      })
      .finally(() => setImpactLoading(false))
  }

  function closeDelete() {
    if (working) return
    setDeleting(null)
    setImpact(null)
    setDeleteError(null)
  }

  async function confirmDelete() {
    if (!deleting) return
    setWorking(true)
    setDeleteError(null)
    try {
      await deleteSupplier(deleting.id)
      setDeleting(null)
      setImpact(null)
      await reload()
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "No se pudo eliminar el proveedor")
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proveedores</h1>
          <p className="text-sm text-gray-600">
            Contactos y artículos asociados. Eliminar un proveedor también elimina sus artículos,
            pero conserva el historial de ventas.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nuevo proveedor
        </button>
      </div>

      {loading && <p className="text-sm text-gray-600">Cargando proveedores…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && suppliers.length === 0 && (
        <p className="text-sm text-gray-600">No hay proveedores cargados</p>
      )}

      {!loading && !error && suppliers.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Teléfono</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2 text-right">Artículos</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{supplier.name}</td>
                  <td className="px-3 py-2 text-gray-700">{supplier.notes || "—"}</td>
                  <td className="px-3 py-2">{supplier.phone || "—"}</td>
                  <td className="px-3 py-2">{supplier.email || "—"}</td>
                  <td className="px-3 py-2 text-right">{supplier.articleCount}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openEdit(supplier)}
                      className="mr-2 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => openDelete(supplier)}
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <SupplierFormModal
          supplier={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            void reload()
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded bg-white p-6">
            <h2 className="mb-2 text-lg font-bold">
              {confirmStep === 1 ? "Eliminar proveedor" : "Confirmación final"}
            </h2>

            {deleteError && (
              <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
            )}

            {confirmStep === 1 && (
              <>
                <p className="mb-3 text-sm text-gray-700">
                  Vas a eliminar <strong>{deleting.name}</strong>. Esto afecta a:
                </p>
                {impactLoading && <p className="mb-3 text-sm text-gray-600">Calculando impacto…</p>}
                {impact && (
                  <ul className="mb-3 list-inside list-disc rounded bg-gray-50 px-4 py-3 text-sm text-gray-800">
                    <li>{impact.articles} artículo(s) que se eliminarán</li>
                    <li>{impact.sales} venta(s) cuyo historial se conserva</li>
                    <li>{impact.saleItems} ítem(s) de venta que se conservan</li>
                  </ul>
                )}
                <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                  Se eliminarán todos sus artículos. El historial de ventas y la auditoría se
                  conservan (cada venta mantiene el nombre del artículo que se vendió). Esta acción
                  no se puede deshacer.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDelete}
                    className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStep(2)}
                    disabled={impactLoading}
                    className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Continuar
                  </button>
                </div>
              </>
            )}

            {confirmStep === 2 && (
              <>
                <p className="mb-4 text-sm text-gray-700">
                  ¿Confirmás la eliminación definitiva de <strong>{deleting.name}</strong>
                  {impact ? ` y sus ${impact.articles} artículo(s)` : ""}? No se puede deshacer.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmStep(1)}
                    disabled={working}
                    className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmDelete()}
                    disabled={working}
                    className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {working ? "Eliminando…" : "Eliminar proveedor y artículos"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
