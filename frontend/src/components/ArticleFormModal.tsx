import { useState } from "react"
import { ApiError } from "../lib/api"
import {
  createArticle,
  updateArticle,
  type Article,
  type ArticleInput,
} from "../lib/articles"

interface Props {
  article: Article | null
  onClose: () => void
  onSaved: () => void
}

function toNumber(value: string): number {
  return Number(value.replace(",", "."))
}

function estimateSalePrice(purchase: number, percentage: number): number | null {
  if (!Number.isFinite(purchase) || !Number.isFinite(percentage) || purchase < 0) {
    return null
  }
  return Math.ceil((purchase * (1 + percentage / 100)) / 100) * 100
}

export function ArticleFormModal({ article, onClose, onSaved }: Props) {
  const isEdit = article !== null
  const [name, setName] = useState(article?.name ?? "")
  const [category, setCategory] = useState(article?.category ?? "")
  const [model, setModel] = useState(article?.motorcycleModel ?? "")
  const [purchasePrice, setPurchasePrice] = useState(
    article?.purchasePrice !== undefined ? String(article.purchasePrice) : "",
  )
  const [percentage, setPercentage] = useState("")
  const [stock, setStock] = useState(article ? String(article.stock) : "")
  const [minStock, setMinStock] = useState(
    article?.minStock !== undefined ? String(article.minStock) : "",
  )
  const [supplier, setSupplier] = useState(article?.supplier ?? "")
  const [barcode, setBarcode] = useState(article?.barcode ?? "")
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const preview = estimateSalePrice(toNumber(purchasePrice), toNumber(percentage))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const purchase = toNumber(purchasePrice)
    const pct = percentage.trim() === "" ? null : toNumber(percentage)
    const stockNum = Number(stock)
    const minStockNum = Number(minStock)

    if (!name.trim() || !category.trim() || !model.trim() || !supplier.trim()) {
      setFormError("Nombre, categoría, modelo y proveedor son obligatorios")
      return
    }
    if (!Number.isFinite(purchase) || purchase < 0) {
      setFormError("El precio de compra debe ser un número mayor o igual a 0")
      return
    }
    if (!isEdit && (pct === null || !Number.isFinite(pct) || pct < 0)) {
      setFormError("El % de ganancia es obligatorio para calcular el precio de venta")
      return
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setFormError("El stock debe ser un entero mayor o igual a 0")
      return
    }
    if (!Number.isInteger(minStockNum) || minStockNum < 0) {
      setFormError("El stock mínimo debe ser un entero mayor o igual a 0")
      return
    }

    setSaving(true)
    try {
      if (isEdit && article) {
        const data: Partial<ArticleInput> = {
          name: name.trim(),
          category: category.trim(),
          motorcycleModel: model.trim(),
          purchasePrice: purchase,
          stock: stockNum,
          minStock: minStockNum,
          supplier: supplier.trim(),
          barcode: barcode.trim() || undefined,
        }
        if (pct !== null && Number.isFinite(pct)) data.percentage = pct
        await updateArticle(article.code, data)
      } else {
        await createArticle({
          name: name.trim(),
          category: category.trim(),
          motorcycleModel: model.trim(),
          purchasePrice: purchase,
          percentage: pct as number,
          stock: stockNum,
          minStock: minStockNum,
          supplier: supplier.trim(),
          barcode: barcode.trim() || undefined,
        })
      }
      onSaved()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full rounded border border-gray-300 px-3 py-2 text-sm"

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded bg-white p-6">
        <h2 className="mb-1 text-xl font-bold">
          {isEdit ? `Editar ${article.code}` : "Nuevo artículo"}
        </h2>
        {!isEdit && (
          <p className="mb-4 text-sm text-gray-600">
            El código se autogenera (ej: FIL-001).
            {preview !== null && (
              <>
                {" "}Precio de venta estimado:{" "}
                <strong>${preview.toLocaleString("es-AR")}</strong>
              </>
            )}
          </p>
        )}

        {formError && (
          <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-sm">
            Nombre *
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Categoría *
              <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
            </label>
            <label className="text-sm">
              Modelo moto *
              <input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Precio compra *
              <input
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                inputMode="decimal"
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              % Ganancia {!isEdit && "*"}
              <input
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                inputMode="decimal"
                placeholder={isEdit ? "(vacío = mantener margen)" : ""}
                className={inputClass}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Stock *
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                inputMode="numeric"
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Stock mínimo *
              <input
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                inputMode="numeric"
                className={inputClass}
              />
            </label>
          </div>
          <label className="text-sm">
            Proveedor *
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm">
            Código de barras (opcional)
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className={inputClass} />
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
