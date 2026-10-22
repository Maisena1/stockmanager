import { endOfLocalDay, parseLocalDate } from "./balance";
import { firstString, parseDateQuery } from "./query";

export type ReportPeriodKind = "day" | "month" | "year" | "range";
export type CompareMode = "previous" | "previousMonth" | "none";

export const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export interface ReportPeriod {
  kind: ReportPeriodKind;
  from: Date;
  to: Date;
  label: string;
  year: number;
  month?: number;
}

export interface SerializedReportPeriod {
  kind: ReportPeriodKind;
  from: string;
  to: string;
  label: string;
  year: number;
  month?: number;
}

export interface ReportPagination {
  page: number;
  limit: number;
  all: boolean;
}

export interface PageInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  all: boolean;
}

export const REPORT_DEFAULT_LIMIT = 25;
export const REPORT_MAX_LIMIT = 100;
export const REPORT_MAX_ALL = 5000;

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${formatTwoDigits(date.getMonth() + 1)}-${formatTwoDigits(
    date.getDate(),
  )}`;
}

export function formatShortDate(date: Date): string {
  return `${formatTwoDigits(date.getDate())}/${formatTwoDigits(
    date.getMonth() + 1,
  )}/${date.getFullYear()}`;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Clave local AAAA-MM-DD para agrupar ventas por día sin cruzar husos. */
export function dateKey(date: Date): string {
  return formatDateOnly(date);
}

export function monthPeriod(year: number, month: number): ReportPeriod {
  const start = new Date(year, month - 1, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  const normalizedYear = start.getFullYear();
  const normalizedMonth = start.getMonth() + 1;

  return {
    kind: "month",
    from: start,
    to: end,
    year: normalizedYear,
    month: normalizedMonth,
    label: `${MONTH_NAMES[normalizedMonth - 1]} ${normalizedYear}`,
  };
}

export function yearPeriod(year: number): ReportPeriod {
  return {
    kind: "year",
    from: new Date(year, 0, 1, 0, 0, 0, 0),
    to: new Date(year, 11, 31, 23, 59, 59, 999),
    year,
    label: `año ${year}`,
  };
}

function rangePeriod(from: Date, to: Date): ReportPeriod {
  const start = startOfLocalDay(from);
  const end = endOfLocalDay(to);

  if (isFullCalendarMonth(start, end)) {
    return {
      kind: "month",
      from: start,
      to: end,
      year: start.getFullYear(),
      month: start.getMonth() + 1,
      label: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`,
    };
  }

  if (isFullCalendarYear(start, end)) {
    return {
      kind: "year",
      from: start,
      to: end,
      year: start.getFullYear(),
      label: `año ${start.getFullYear()}`,
    };
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  return {
    kind: sameDay ? "day" : "range",
    from: start,
    to: end,
    year: start.getFullYear(),
    label: sameDay
      ? formatShortDate(start)
      : `${formatShortDate(start)} – ${formatShortDate(end)}`,
  };
}

function isFullCalendarMonth(from: Date, to: Date): boolean {
  if (from.getDate() !== 1) return false;
  if (from.getFullYear() !== to.getFullYear() || from.getMonth() !== to.getMonth()) {
    return false;
  }
  const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  return to.getDate() === lastDay;
}

function isFullCalendarYear(from: Date, to: Date): boolean {
  return (
    from.getMonth() === 0 &&
    from.getDate() === 1 &&
    to.getMonth() === 11 &&
    to.getDate() === 31 &&
    from.getFullYear() === to.getFullYear()
  );
}

function parseYear(value: unknown): number | undefined | null {
  const raw = firstString(value);
  if (raw === undefined || raw === "") return undefined;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  return year;
}

function parseMonth(value: unknown): number | undefined | null {
  const raw = firstString(value);
  if (raw === undefined || raw === "") return undefined;
  const month = Number(raw);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month;
}

/**
 * Resuelve el período de un reporte en un solo lugar (RF-80).
 * Prioridad: from/to explícitos > year+month > último mes calendario completo.
 */
export function resolveReportPeriod(
  query: Record<string, unknown>,
  now = new Date(),
): { ok: true; period: ReportPeriod } | { ok: false; error: string } {
  const hasFrom = firstString(query.from) !== undefined && firstString(query.from) !== "";
  const hasTo = firstString(query.to) !== undefined && firstString(query.to) !== "";

  if (hasFrom || hasTo) {
    const parsedFrom = parseDateQuery(query.from, false);
    if (parsedFrom === null) {
      return { ok: false, error: "La fecha desde no es válida (formato AAAA-MM-DD)" };
    }
    const parsedTo = parseDateQuery(query.to, true);
    if (parsedTo === null) {
      return { ok: false, error: "La fecha hasta no es válida (formato AAAA-MM-DD)" };
    }

    const from = parsedFrom ?? startOfLocalDay(parsedTo!);
    const to = parsedTo ?? endOfLocalDay(parsedFrom!);
    if (from.getTime() > to.getTime()) {
      return {
        ok: false,
        error: "El rango de fechas es inválido: desde no puede ser posterior a hasta",
      };
    }
    return { ok: true, period: rangePeriod(from, to) };
  }

  const year = parseYear(query.year);
  if (year === null) {
    return { ok: false, error: "El año no es válido (debe ser un número entre 1900 y 2200)" };
  }
  const month = parseMonth(query.month);
  if (month === null) {
    return { ok: false, error: "El mes no es válido (debe ser un número entre 1 y 12)" };
  }

  if (month !== undefined) {
    return { ok: true, period: monthPeriod(year ?? now.getFullYear(), month) };
  }
  if (year !== undefined) {
    return { ok: true, period: yearPeriod(year) };
  }

  // Por defecto, el último mes calendario completo: si hoy es 19/10/2026,
  // el rango es 01/09/2026 – 30/09/2026.
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    ok: true,
    period: monthPeriod(previousMonth.getFullYear(), previousMonth.getMonth() + 1),
  };
}

export function parseCompareMode(value: unknown): CompareMode | null {
  const raw = firstString(value);
  if (raw === undefined || raw === "") return "previous";
  if (raw === "previous" || raw === "previousMonth" || raw === "none") return raw;
  return null;
}

function previousMonthOf(period: ReportPeriod): ReportPeriod {
  const start = new Date(period.from.getFullYear(), period.from.getMonth() - 1, 1);
  return monthPeriod(start.getFullYear(), start.getMonth() + 1);
}

/**
 * Período equivalente anterior.
 * - Un mes calendario compara contra el mes anterior completo.
 * - Un año compara contra el año anterior.
 * - Un rango libre compara contra un rango del mismo largo, inmediatamente
 *   anterior.
 */
export function previousReportPeriod(
  period: ReportPeriod,
  mode: CompareMode,
): ReportPeriod | null {
  if (mode === "none") return null;
  if (mode === "previousMonth") return previousMonthOf(period);

  if (period.kind === "month") return previousMonthOf(period);
  if (period.kind === "year") return yearPeriod(period.year - 1);

  const start = startOfLocalDay(period.from);
  const end = startOfLocalDay(period.to);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousEnd.setHours(23, 59, 59, 999);

  const previousStart = startOfLocalDay(previousEnd);
  previousStart.setDate(previousStart.getDate() - (days - 1));

  return rangePeriod(previousStart, previousEnd);
}

export function serializePeriod(period: ReportPeriod): SerializedReportPeriod {
  return {
    kind: period.kind,
    from: formatDateOnly(period.from),
    to: formatDateOnly(period.to),
    label: period.label,
    year: period.year,
    month: period.month,
  };
}

function positiveInteger(value: unknown): number | undefined {
  const raw = firstString(value);
  if (raw === undefined || raw === "") return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

export function parseReportPagination(
  query: Record<string, unknown>,
): ReportPagination {
  const page = positiveInteger(query.page) ?? 1;
  const requestedLimit = positiveInteger(query.limit) ?? REPORT_DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, REPORT_MAX_LIMIT);
  const allRaw = firstString(query.all);
  const all = allRaw === "true" || allRaw === "1";

  return { page, limit, all };
}

export function paginate<T>(
  rows: T[],
  pagination: ReportPagination,
): { rows: T[]; info: PageInfo } {
  const total = rows.length;

  if (pagination.all) {
    const limited = rows.slice(0, REPORT_MAX_ALL);
    return {
      rows: limited,
      info: {
        page: 1,
        limit: limited.length,
        total,
        totalPages: 1,
        all: true,
      },
    };
  }

  const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
  const page = Math.min(Math.max(1, pagination.page), totalPages);
  const start = (page - 1) * pagination.limit;

  return {
    rows: rows.slice(start, start + pagination.limit),
    info: {
      page,
      limit: pagination.limit,
      total,
      totalPages,
      all: false,
    },
  };
}
