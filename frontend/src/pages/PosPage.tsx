import { useEffect, useMemo, useRef, useState } from "react"
import { api } from "../lib/api"
import { useDebounce } from "../hooks/useDebounce"

interface Article {
  code: string
  name: string
  salePrice: number
  stock: number
}

interface CartLine {
  code: string
  name: string
  unitPrice: number
  quantity: number
  stock: number
}

export default function PosPage() {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 300)
  const [results, setResults] = useState<Article[]>([])
  const [cart, setCart] = useState<CartLine[]>([])

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }
    api
      .get<Article[]>(`/articles?q=${encodeURIComponent(debouncedQuery.trim())}`)
      .then((data) => setResults(data))
      .catch(() => setResults([]))
  }, [debouncedQuery])

  function addToCart(article: Article) {
    setCart((prev) => {
      const existing = prev.find((l) => l.code === article.code)
      if (existing) {
        return prev.map((l) =>
          l.code === article.code ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          code: article.code,
          name: article.name,
          unitPrice: article.salePrice,
          quantity: 1,
          stock: article.stock,
        },
      ]
    })
  }

  function setQuantity(code: string, quantity: number) {
    if (quantity < 1) return
    setCart((prev) =>
      prev.map((l) => (l.code === code ? { ...l, quantity } : l)),
    )
  }

  function removeLine(code: string) {
    setCart((prev) => prev.filter((l) => l.code !== code))
  }

  const total = useMemo(
    () => cart.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0),
    [cart],
  )

  const searchRef = useRef<HTMLInputElement>(null)

  return (
    <div className="grid h-[calc(100vh-120px)] grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-3">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código, nombre o código de barras..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              {debouncedQuery.trim()
                ? "Sin resultados"
                : "Escribí para buscar artículos"}
            </p>
          ) : (
            <ul>
              {results.map((a) => (
                <li key={a.code}>
                  <button
                    type="button"
                    onClick={() => addToCart(a)}
                    className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">
                        ${a.salePrice.toLocaleString("es-AR")}
                      </p>
                      <p className="text-xs text-gray-500">
                        Stock: {a.stock}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-3">
          <h2 className="font-bold text-gray-800">Carrito</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              El carrito está vacío
            </p>
          ) : (
            <ul>
              {cart.map((l) => (
                <li
                  key={l.code}
                  className="flex items-center gap-3 border-b border-gray-100 px-4 py-3"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{l.name}</p>
                    <p className="text-xs text-gray-500">
                      ${l.unitPrice.toLocaleString("es-AR")} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(l.code, l.quantity - 1)}
                      className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) =>
                        setQuantity(l.code, Number(e.target.value))
                      }
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-gray-800"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(l.code, l.quantity + 1)}
                      className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-24 text-right">
                    <p className="font-semibold text-gray-800">
                      ${(l.unitPrice * l.quantity).toLocaleString("es-AR")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(l.code)}
                    aria-label="Quitar línea"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M6 18L18 6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total</span>
            <span className="text-xl font-bold text-gray-800">
              ${total.toLocaleString("es-AR")}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}