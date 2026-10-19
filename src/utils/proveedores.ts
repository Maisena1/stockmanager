export function normalizeSupplierName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name === "" ? null : name;
}

export function parsePositiveId(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type OptionalText =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export function parseOptionalText(value: unknown, field: string): OptionalText {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `El campo ${field} debe ser texto` };
  }
  return { ok: true, value: value.trim() || null };
}
