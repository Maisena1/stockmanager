import { useEffect, useState } from "react"
import { ApiError } from "../lib/api"
import { listArticles, type Article } from "../lib/articles"
import { listSupplierOptions, type SupplierOption } from "../lib/suppliers"
import { useAuth } from "../contexts/AuthContext"
import { useDebounce } from "../hooks/useDebounce"
import { ArticleFormModal } from "../components/ArticleFormModal"
import { ConfirmDelete } from "../components/ConfirmDelete"

const PAGE_SIZE = 40

function isLowStock(a: Article): boolean {
  return a.minStock !== undefined && a.stock <= a.minStock
}

export default function ArticlesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN"
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 300)
  const [supplierId, setSupplierId] = useState("")
  const [updatedFrom, setUpdatedFrom] = useState("")
  const [updatedTo, setUpdatedTo] = useState("")
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Article | null>(null)
  const [deleting, setDeleting] = useState<Article | null>(null)

  useEffect(() => {
    let cancelled = false
    listSupplierOptions()
      .then((data) => {
        if (!cancelled) setSuppliers(data)
      })
      .catch(() => {
        if (!cancelled) setSuppliers([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    listArticles({
      q: debouncedQuery,
      supplierId: supplierId ? Number(supplierId) : undefined,
      updatedFrom: updatedFrom || undefined,
      updatedTo: updatedTo || undefined,
      lowStock: lowStockOnly || undefined,
    })
      .then((data) => {
        if (cancelled) return
        setArticles(data)
        setPage(1)
      })
      .catch((e) => {
        if (cancelled) return
        setArticles([])
        setError(e instanceof ApiError ? e.message : "No se pudo cargar")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, supplierId, updatedFrom, updatedTo, lowStockOnly])

  const totalPages = Math.max(1, Math.ceil(articles.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = articles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const supplierName = suppliers.find((s) => String(s.id) === supplierId)?.name
  const activeFilters = [
    query.trim() ? { key: "q", label: `Búsqueda: "${query.trim()}"` } : null,
    supplierId ? { key: "supplier", label: `Proveedor: ${supplierName ?? supplierId}` } : null,
    updatedFrom ? { key: "from", label: `Desde: ${updatedFrom}` } : null,
    updatedTo ? { key: "to", label: `Hasta: ${updatedTo}` } : null,
    lowStockOnly ? { key: "lowStock", label: "Solo stock bajo" } : null,
  ].filter((filter): filter is { key: string; label: string } => filter !== null)

  function clearError() {
    setError(null)
  }

  function clearFilters() {
    setQuery("")
    setSupplierId("")
    setUpdatedFrom("")
    setUpdatedTo("")
    setLowStockOnly(false)
    clearError()
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(a: Article) {
    setEditing(a)
    setFormOpen(true)
  }

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listArticles({
        q: debouncedQuery,
        supplierId: supplierId ? Number(supplierId) : undefined,
        updatedFrom: updatedFrom || undefined,
        updatedTo: updatedTo || undefined,
        lowStock: lowStockOnly || undefined,
      })
      setArticles(data)
      setPage((p) => Math.min(p, Math.max(1, Math.ceil(data.length / PAGE_SIZE))))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cargar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Artículos</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Nuevo artículo
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Buscar
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              clearError()
            }}
            placeholder="Nombre, categoría, modelo, código o proveedor..."
            className="w-full min-w-72 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Proveedor
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value)
              clearError()
            }}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Modificado desde
          <input
            type="date"
            value={updatedFrom}
            max={updatedTo || undefined}
            onChange={(e) => {
              setUpdatedFrom(e.target.value)
              clearError()
            }}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Modificado hasta
          <input
            type="date"
            value={updatedTo}
            min={updatedFrom || undefined}
            onChange={(e) => {
              setUpdatedTo(e.target.value)
              clearError()
            }}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => {
              setLowStockOnly(e.target.checked)
              clearError()
            }}
          />
          Solo stock bajo
        </label>
      </div>

      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">
            Filtros activos ({activeFilters.length}):
          </span>
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
            >
              {filter.label}
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-gray-600">Cargando artículos…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && articles.length === 0 && (
        <p className="text-sm text-gray-600">No se encontraron artículos</p>
      )}

      {!loading && !error && articles.length > 0 && (
        <>
          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2">Modelo</th>
                  {isAdmin && <th className="px-3 py-2 text-right">Compra</th>}
                  <th className="px-3 py-2 text-right">Venta</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  {isAdmin && <th className="px-3 py-2 text-right">Mínimo</th>}
                  <th className="px-3 py-2">Proveedor</th>
                  {isAdmin && <th className="px-3 py-2">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr
                    key={a.code}
                    className={`border-t border-gray-100 ${isLowStock(a) ? "bg-red-50" : ""}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{a.code}</td>
                    <td className="px-3 py-2 font-medium">
                      {a.name}{" "}
                      {isLowStock(a) && (
                        <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          Bajo stock
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{a.category}</td>
                    <td className="px-3 py-2">{a.motorcycleModel}</td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right">
                        {a.purchasePrice?.toLocaleString("es-AR") ?? "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      {a.salePrice.toLocaleString("es-AR")}
                    </td>
                    <td className="px-3 py-2 text-right">{a.stock}</td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right">{a.minStock ?? "—"}</td>
                    )}
                    <td className="px-3 py-2">{a.supplierName ?? "—"}</td>
                    {isAdmin && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="mr-2 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(a)}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <span>
              Página {safePage} de {totalPages} ({articles.length} artículos)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      {formOpen && (
        <ArticleFormModal
          article={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            void reload()
          }}
        />
      )}

      {deleting && (
        <ConfirmDelete
          code={deleting.code}
          name={deleting.name}
          onCancel={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            void reload()
          }}
        />
      )}
    </div>
  )
}
