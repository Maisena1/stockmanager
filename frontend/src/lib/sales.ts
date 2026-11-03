import { api } from "./api"

export type PaymentMethod = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA"

export interface SaleItem {
    id: number
    articleCode: string | null
    articleName: string
    quantity: number
    unitPrice: number
    total: number
}

export interface Sale {
    id: number
    userId: number
    total: number
    paymentMethod: PaymentMethod
    createdAt: string
    user: { username: string }
    items: SaleItem[]
}

export interface Balance {
    count: number
    total: number
    byPayment: Record<string, { count: number; total: number }>
}

export interface DateRange {
    from?: string
    to?: string
    paymentMethod?: PaymentMethod
}

function toQuery(range: DateRange): string {
    const params= new URLSearchParams()
    if (range.from) params.set("from", range.from)
    if (range.to) params.set("to", range.to)
    if (range.paymentMethod) params.set("paymentMethod", range.paymentMethod)
    const q = params.toString()
    return q ? `?${q}` : ""
}

export function listSales(range: DateRange = {}): Promise<Sale[]> {
    return api.get<Sale[]>(`/sales${toQuery(range)}`)
}

export function getBalance(range: DateRange = {}):Promise<Balance> {
    // Si el usuario filtró por tipo de pago pero no puso fechas, el balance
    // pega a /balance en vez de /balance/today (que no filtra por pago).
    if (!range.from && !range.to && !range.paymentMethod) return api.get<Balance>("/balance/today")
        return api.get<Balance>(`/balance${toQuery(range)}`)
}