import { api } from "./api"
import type { AuditAction } from "./audit"

export interface Turno {
  id: number
  userId: number
  abiertoAt: string
  cerradoAt: string | null
  user: { id: number; username: string; role: "ADMIN" | "EMPLOYEE" }
}

export interface ResumenVentas {
  count: number
  total: number
  byPayment: Record<string, { count: number; total: number }>
}

export interface ResumenAccion {
  id: number
  action: AuditAction
  detail: string
  createdAt: string
}

export interface TurnoResumen {
  ventas: ResumenVentas
  acciones: ResumenAccion[]
  accionesCount: number
}

export interface TurnoConResumen {
  turno: Turno
  resumen: TurnoResumen
}

export function listTurnos(): Promise<Turno[]> {
  return api.get<Turno[]>("/turns")
}

export function getTurno(id: number): Promise<TurnoConResumen> {
  return api.get<TurnoConResumen>(`/turns/${id}`)
}

export function closeTurno(turnId?: number): Promise<TurnoConResumen> {
  return api.post<TurnoConResumen>(
    "/turns/close",
    turnId != null ? { turnId } : {},
  )
}
