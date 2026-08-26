export function calculateSalePrice(purchasePrice: number, percentage: number): number {
  const raw = purchasePrice + (purchasePrice * percentage) / 100;
  return Math.ceil(raw / 100) * 100;
}
