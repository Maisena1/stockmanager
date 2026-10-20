import { api } from "./api"

export interface Article {
  code: string
  name: string
  category: string
  motorcycleModel: string
  purchasePrice?: number
  salePrice: number
  stock: number
  minStock?: number
  supplierId?: number | null
  supplierName?: string | null
  barcode?: string | null
  photo?: string | null
  updatedAt: string
}

export interface ArticleInput {
  name: string
  category: string
  motorcycleModel: string
  purchasePrice: number
  percentage: number
  stock: number
  minStock: number
  supplierId: number
  barcode?: string
}

export interface ArticleFilters {
  q?: string
  supplierId?: number
  supplier?: string
  updatedFrom?: string
  updatedTo?: string
  lowStock?: boolean
}

export function listArticles(filters: ArticleFilters = {}): Promise<Article[]> {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set("q", filters.q.trim())
  if (filters.supplierId != null) params.set("supplierId", String(filters.supplierId))
  if (filters.supplier?.trim()) params.set("supplier", filters.supplier.trim())
  if (filters.updatedFrom) params.set("updatedFrom", filters.updatedFrom)
  if (filters.updatedTo) params.set("updatedTo", filters.updatedTo)
  if (filters.lowStock) params.set("lowStock", "true")

  const query = params.toString()
  return api.get<Article[]>(`/articles${query ? `?${query}` : ""}`)
}

export function createArticle(data: ArticleInput): Promise<Article> {
  return api.post<Article>("/articles", data)
}

export function updateArticle(
  code: string,
  data: Partial<ArticleInput>,
): Promise<Article> {
  return api.put<Article>(`/articles/${encodeURIComponent(code)}`, data)
}

export function deleteArticle(code: string): Promise<void> {
  return api.delete<void>(`/articles/${encodeURIComponent(code)}`)
}
