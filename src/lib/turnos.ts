import { Prisma, PrismaClient, AuditAction } from "../generated/prisma/client";
import { computeBalance, type BalanceResult } from "../utils/balance";

/**
 * Igual que en audit: acepta el cliente normal o el de transacción para poder
 * escribir el turno junto con la operación que lo abre (RNF-30).
 */
export type TurnoClient = PrismaClient | Prisma.TransactionClient;

/**
 * Abre un turno para el usuario sólo si no tiene uno activo. Se llama en el
 * login: si el usuario ya tenía un turno abierto (por ejemplo, se fue sin
 * cerrarlo) se reutiliza en vez de duplicarlo.
 */
export async function ensureTurnoAbierto(db: TurnoClient, userId: number) {
  const abierto = await db.turno.findFirst({
    where: { userId, cerradoAt: null },
    orderBy: { abiertoAt: "desc" },
  });
  if (abierto) return abierto;
  return db.turno.create({ data: { userId } });
}

export interface ResumenAccion {
  id: number;
  action: AuditAction;
  detail: string;
  createdAt: Date;
}

export interface TurnoResumen {
  ventas: BalanceResult;
  acciones: ResumenAccion[];
  accionesCount: number;
}

/**
 * Resumen de cierre: balance del turno (RF-63, reutilizando computeBalance)
 * + las acciones del audit log ocurridas dentro de la ventana del turno.
 * Pura, para poder testearla sin base.
 */
export function buildResumen(
  ventas: Parameters<typeof computeBalance>[0],
  acciones: ResumenAccion[],
): TurnoResumen {
  return {
    ventas: computeBalance(ventas),
    acciones,
    accionesCount: acciones.length,
  };
}
