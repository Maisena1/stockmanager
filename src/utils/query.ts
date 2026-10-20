import { endOfLocalDay, parseLocalDate } from "./balance";

/**
 * Express 5 puede entregar los query params como string, string[] o
 * ParsedQs. Para los filtros aceptamos el primer string disponible.
 */
export function firstString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}

/**
 * true/false para filtros booleanos.
 * Devuelve undefined si no vino, null si el valor es inválido.
 */
export function parseBooleanQuery(value: unknown): boolean | undefined | null {
  const raw = firstString(value);
  if (raw === undefined || raw === "") return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

/**
 * Fecha AAAA-MM-DD interpretada en horario local. Si endOfDay es true,
 * devuelve el final del día para que el rango sea inclusivo.
 * undefined = no vino; null = inválida.
 */
export function parseDateQuery(
  value: unknown,
  endOfDay: boolean,
): Date | undefined | null {
  const raw = firstString(value);
  if (raw === undefined || raw === "") return undefined;

  const date = parseLocalDate(raw);
  if (!date || !isSameDateOnly(raw, date)) return null;

  return endOfDay ? endOfLocalDay(date) : date;
}

function isSameDateOnly(raw: string, date: Date): boolean {
  const parts = raw.split("-");
  if (parts.length !== 3) return false;

  const [year, month, day] = parts.map(Number);
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
