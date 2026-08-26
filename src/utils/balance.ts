export interface BalanceEntry {
  total: number;
  paymentMethod: string;
  createdAt: Date;
}

export interface BalanceResult {
  count: number;
  total: number;
  byPayment: Record<string, { count: number; total: number }>;
}

export function computeBalance(sales: BalanceEntry[]): BalanceResult {
  const byPayment: BalanceResult["byPayment"] = {};
  for (const sale of sales) {
    byPayment[sale.paymentMethod] ??= { count: 0, total: 0 };
    byPayment[sale.paymentMethod].count += 1;
    byPayment[sale.paymentMethod].total += sale.total;
  }
  return {
    count: sales.length,
    total: sales.reduce((sum, s) => sum + s.total, 0),
    byPayment,
  };
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseLocalDate(value: string): Date | undefined {
  const [y, m, d] = value.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return undefined;
  }
  return new Date(y, m - 1, d);
}

export function endOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}