import { describe, it, expect, vi } from "vitest";
import { buildResumen, ensureTurnoAbierto, type ResumenAccion } from "./turnos";

const hoy = new Date();

function venta(
  total: number,
  paymentMethod: string,
  items: Array<{ id: number; articleName: string; quantity: number; unitPrice: number; total: number }> = [],
) {
  return { id: items[0]?.id ?? 1, total, paymentMethod, createdAt: hoy, items };
}

function accion(id: number, detail: string): ResumenAccion {
  return { id, action: "VENTA", detail, createdAt: hoy };
}

describe("buildResumen", () => {
  it("arma el balance del turno con total y desglose por tipo de pago", () => {
    const resumen = buildResumen(
      [venta(4000, "EFECTIVO"), venta(8000, "EFECTIVO"), venta(45000, "TARJETA")],
      [],
    );

    expect(resumen.ventas.count).toBe(3);
    expect(resumen.ventas.total).toBe(57000);
    expect(resumen.ventas.byPayment.EFECTIVO).toEqual({ count: 2, total: 12000 });
    expect(resumen.ventas.byPayment.TARJETA).toEqual({ count: 1, total: 45000 });
  });

  it("deja el detalle de cada venta con sus ítems para el modal", () => {
    const items = [
      { id: 1, articleName: "Filtro", quantity: 2, unitPrice: 2000, total: 4000 },
    ];
    const resumen = buildResumen([venta(4000, "EFECTIVO", items)], []);

    expect(resumen.ventasDetalle).toHaveLength(1);
    expect(resumen.ventasDetalle[0]).toMatchObject({
      id: 1,
      total: 4000,
      paymentMethod: "EFECTIVO",
      items,
    });
  });

  it("incluye las acciones del audit log dentro de la ventana", () => {
    const acciones = [accion(1, "Venta #1"), accion(2, "Artículo FIL-001 creado")];
    const resumen = buildResumen([venta(1000, "EFECTIVO")], acciones);

    expect(resumen.accionesCount).toBe(2);
    expect(resumen.acciones.map((a) => a.detail)).toEqual([
      "Venta #1",
      "Artículo FIL-001 creado",
    ]);
  });

  it("un turno sin ventas ni acciones devuelve balance en cero", () => {
    const resumen = buildResumen([], []);

    expect(resumen.ventas).toEqual({ count: 0, total: 0, byPayment: {} });
    expect(resumen.accionesCount).toBe(0);
  });
});

describe("ensureTurnoAbierto", () => {
  it("crea un turno si el usuario no tiene uno abierto", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: 7, userId: 1, abiertoAt: hoy, cerradoAt: null });
    const db = { turno: { findFirst, create } } as never;

    const turno = await ensureTurnoAbierto(db, 1);

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 1, cerradoAt: null },
      orderBy: { abiertoAt: "desc" },
    });
    expect(create).toHaveBeenCalledWith({ data: { userId: 1 } });
    expect(turno.id).toBe(7);
  });

  it("reutiliza el turno abierto en vez de duplicarlo", async () => {
    const abierto = { id: 3, userId: 1, abiertoAt: hoy, cerradoAt: null };
    const findFirst = vi.fn().mockResolvedValue(abierto);
    const create = vi.fn();
    const db = { turno: { findFirst, create } } as never;

    const turno = await ensureTurnoAbierto(db, 1);

    expect(turno).toBe(abierto);
    expect(create).not.toHaveBeenCalled();
  });
});
