import { Prisma, PrismaClient, AuditAction } from "../generated/prisma/client";
import {
  computeBalance,
  type BalanceEntry,
  type BalanceResult,
} from "../utils/balance";

/**
 * Igual que en audit: acepta el cliente normal o el de transacción para poder
 * escribir el turno junto con la operación que lo abre (RNF-30).
 */
export type TurnoClient = PrismaClient | Prisma.TransactionClient;

/**
 * Abre un turno para el usuario sólo si no tiene uno activo. Se llama en el
 * login y también al crear una venta: si el turno quedó cerrado y se vende
 * igual, la venta abre uno nuevo en la misma transacción (RNF-30).
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

/** Línea de una venta individual del resumen (RF-63). */
export interface ResumenVentaItem {
  id: number;
  articleName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Venta individual dentro del turno, con sus líneas listas para desplegar. */
export interface ResumenVenta extends BalanceEntry {
  id: number;
  items: ResumenVentaItem[];
}

export interface TurnoResumen {
  ventas: BalanceResult;
  /** Detalle de cada venta del turno, para el filtro/despliegue del modal. */
  ventasDetalle: ResumenVenta[];
  acciones: ResumenAccion[];
  accionesCount: number;
}

/**
 * Resumen de cierre: balance del turno (RF-63, reutilizando computeBalance)
 * + las acciones del audit log ocurridas dentro de la ventana del turno
 * + el detalle de cada venta para el modal. Pura, para poder testearla sin base.
 */
export function buildResumen(
  ventas: ResumenVenta[],
  acciones: ResumenAccion[],
): TurnoResumen {
  return {
    ventas: computeBalance(ventas),
    // Armamos el detalle explícito para no mandar campos crudos del modelo.
    ventasDetalle: ventas.map(({ id, total, paymentMethod, createdAt, items }) => ({
      id,
      total,
      paymentMethod,
      createdAt,
      items,
    })),
    acciones,
    accionesCount: acciones.length,
  };
}
