import { api } from "./api"

export interface Supplier {
  id: number
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  createdAt: string
  articleCount: number
}

export interface SupplierOption {
  id: number
  name: string
}

export interface SupplierInput {
  name: string
  phone?: string | null
  email?: string | null
  notes?: string | null
}

export interface SupplierImpact {
  id: number
  name: string
  articles: number
  sales: number
  saleItems: number
  canDelete: boolean
}

export function listSuppliers(): Promise<Supplier[]> {
  return api.get<Supplier[]>("/suppliers")
}

export function listSupplierOptions(): Promise<SupplierOption[]> {
  return api.get<SupplierOption[]>("/suppliers/options")
}

export function createSupplier(data: SupplierInput): Promise<Supplier> {
  return api.post<Supplier>("/suppliers", data)
}

export function updateSupplier(id: number, data: Partial<SupplierInput>): Promise<Supplier> {
  return api.patch<Supplier>(`/suppliers/${id}`, data)
}

export function getSupplierImpact(id: number): Promise<SupplierImpact> {
  return api.get<SupplierImpact>(`/suppliers/${id}/impact`)
}

export function deleteSupplier(id: number): Promise<void> {
  return api.delete<void>(`/suppliers/${id}`)
}
