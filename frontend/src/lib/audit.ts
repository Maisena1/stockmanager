import { api } from "./api"

export type AuditAction =
  | "VENTA"
  | "IMPORTACION"
  | "ARTICULO_CREADO"
  | "ARTICULO_ACTUALIZADO"
  | "ARTICULO_ELIMINADO"
  | "PROVEEDOR_CREADO"
  | "PROVEEDOR_ACTUALIZADO"
  | "PROVEEDOR_ELIMINADO"

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  VENTA: "Venta",
  IMPORTACION: "Importación de Excel",
  ARTICULO_CREADO: "Artículo creado",
  ARTICULO_ACTUALIZADO: "Artículo actualizado",
  ARTICULO_ELIMINADO: "Artículo eliminado",
  PROVEEDOR_CREADO: "Proveedor creado",
  PROVEEDOR_ACTUALIZADO: "Proveedor actualizado",
  PROVEEDOR_ELIMINADO: "Proveedor eliminado",
}

export interface AuditUser {
  id: number
  username: string
  role: "ADMIN" | "EMPLOYEE"
}

export interface AuditEntry {
  id: number
  action: AuditAction
  detail: string
  createdAt: string
  user: { id: number; username: string; role: "ADMIN" | "EMPLOYEE" }
}

export interface AuditPage {
  items: AuditEntry[]
  total: number
  page: number
  pageSize: number
}

export interface AuditParams {
  from?: string
  to?: string
  userId?: number
  action?: AuditAction
  page?: number
  pageSize?: number
}

export function listAuditUsers(): Promise<AuditUser[]> {
  return api.get<AuditUser[]>("/audit/users")
}

export function listAudit(params: AuditParams = {}): Promise<AuditPage> {
  const query = new URLSearchParams()
  if (params.from) query.set("from", params.from)
  if (params.to) query.set("to", params.to)
  if (params.userId != null) query.set("userId", String(params.userId))
  if (params.action) query.set("action", params.action)
  if (params.page) query.set("page", String(params.page))
  if (params.pageSize) query.set("pageSize", String(params.pageSize))
  const qs = query.toString()
  return api.get<AuditPage>(`/audit${qs ? `?${qs}` : ""}`)
}
