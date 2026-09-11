import { api } from "./api"

export type PaymentMethod = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA"

export interface SaleItem {
    id: number
    articleCode: string
    quantity: number
    unitPrice: number
    total: number
    article: { name: string }
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
}

function toQuery(range: DateRange): string {
    const params= new URLSearchParams()
    if (range.from) params.set("from", range.from)
    if (range.to) params.set("to", range.to)
    const q = params.toString()
    return q ? `?${q}` : ""
}

export function listSales(range: DateRange = {}): Promise<Sale[]> {
    return api.get<Sale[]>(`/sales${toQuery(range)}`)
}

export function getBalance(range: DateRange = {}):Promise<Balance> {
    if (!range.from && !range.to) return api.get<Balance>("/balance/today")
        return api.get<Balance>(`/balance${toQuery(range)}`)
}