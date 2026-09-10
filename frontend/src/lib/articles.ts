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
  supplier: string
  barcode?: string | null
  photo?: string | null
}

export interface ArticleInput {
  name: string
  category: string
  motorcycleModel: string
  purchasePrice: number
  percentage: number
  stock: number
  minStock: number
  supplier: string
  barcode?: string
}

export function listArticles(q = ""): Promise<Article[]> {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""
  return api.get<Article[]>(`/articles${query}`)
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
