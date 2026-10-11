import { AuditAction, Prisma, PrismaClient } from "../generated/prisma/client";
import { parseLocalDate, endOfLocalDay } from "../utils/balance";

/**
 * Acepta el cliente normal o el de transacción: así el log se escribe dentro
 * de la MISMA transacción que la operación y nunca queda acción sin log ni
 * log sin acción (RNF-30).
 */
export type AuditClient = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  userId: number;
  action: AuditAction;
  detail: string;
}

export async function logAudit(db: AuditClient, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({ data: entry });
}

export interface AuditFilters {
  where: {
    createdAt?: { gte?: Date; lte?: Date };
    userId?: number;
    action?: AuditAction;
  };
  page: number;
  pageSize: number;
}

export type ParseAuditQueryResult =
  | { ok: true; filters: AuditFilters }
  | { ok: false; error: string };

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

/**
 * Convierte los query params de GET /api/audit en filtros de Prisma.
 * Pura: se testea sin servidor ni base (ver audit.test.ts).
 */
export function parseAuditQuery(query: Record<string, unknown>): ParseAuditQueryResult {
  const where: AuditFilters["where"] = {};

  for (const key of ["from", "to", "userId", "action", "page", "pageSize"] as const) {
    const value = query[key];
    if (value !== undefined && typeof value !== "string") {
      return { ok: false, error: `Parámetro inválido: ${key}` };
    }
  }

  if (typeof query.from === "string" && query.from) {
    const parsed = parseLocalDate(query.from);
    if (!parsed) return { ok: false, error: "Fecha 'from' inválida (usa el formato AAAA-MM-DD)" };
    where.createdAt = { gte: parsed };
  }
  if (typeof query.to === "string" && query.to) {
    const parsed = parseLocalDate(query.to);
    if (!parsed) return { ok: false, error: "Fecha 'to' inválida (usa el formato AAAA-MM-DD)" };
    where.createdAt = { ...(where.createdAt ?? {}), lte: endOfLocalDay(parsed) };
  }

  if (typeof query.userId === "string" && query.userId) {
    const userId = parsePositiveInt(query.userId);
    if (userId === undefined) return { ok: false, error: "El filtro de usuario debe ser un número entero positivo" };
    where.userId = userId;
  }

  if (typeof query.action === "string" && query.action) {
    if (!Object.values(AuditAction).includes(query.action as AuditAction)) {
      return {
        ok: false,
        error: `Acción inválida. Valores permitidos: ${Object.values(AuditAction).join(", ")}`,
      };
    }
    where.action = query.action as AuditAction;
  }

  let page = 1;
  if (query.page !== undefined && query.page !== "") {
    const parsedPage = parsePositiveInt(query.page);
    if (parsedPage === undefined) {
      return { ok: false, error: "La página debe ser un número entero positivo" };
    }
    page = parsedPage;
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  if (query.pageSize !== undefined && query.pageSize !== "") {
    const parsedSize = parsePositiveInt(query.pageSize);
    if (parsedSize === undefined || parsedSize > MAX_PAGE_SIZE) {
      return { ok: false, error: `El tamaño de página debe estar entre 1 y ${MAX_PAGE_SIZE}` };
    }
    pageSize = parsedSize;
  }

  return { ok: true, filters: { where, page, pageSize } };
}

const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

export function formatDetailMoney(value: number): string {
  return `$${money.format(value)}`;
}
