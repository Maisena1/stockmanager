import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, minStockField } = vi.hoisted(() => {
  const minStockField = { __field: "minStock" };
  const mock = {
    sale: { findMany: vi.fn() },
    saleItem: { findMany: vi.fn() },
    article: {
      findMany: vi.fn(),
      fields: { minStock: minStockField },
    },
  } as any;
  return { prismaMock: mock, minStockField };
});

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import {
  lowStockReport,
  monthlyReport,
  purchasesReport,
  salesReport,
  topProductsReport,
} from "../src/controllers/report.controller";
import { requireRole } from "../src/middlewares/roles";
import {
  paginate,
  parseReportPagination,
  previousReportPeriod,
  resolveReportPeriod,
} from "../src/utils/reports";

function fakeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = vi.fn(() => res);
  return res;
}

function fakeReq(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { userId: 1, role: "ADMIN" },
    ...overrides,
  } as any;
}

function article(overrides: Record<string, unknown> = {}) {
  return {
    code: "FIL-001",
    name: "Filtro de aceite",
    category: "Filtros",
    motorcycleModel: "Honda",
    purchasePrice: 1000,
    salePrice: 2000,
    stock: 2,
    minStock: 5,
    supplierId: 3,
    supplierInfo: { id: 3, name: "Repuestos Norte" },
    barcode: null,
    photo: null,
    updatedAt: new Date("2026-09-15T12:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.sale.findMany.mockReset();
  prismaMock.saleItem.findMany.mockReset();
  prismaMock.article.findMany.mockReset();
  prismaMock.sale.findMany.mockResolvedValue([]);
  prismaMock.saleItem.findMany.mockResolvedValue([]);
  prismaMock.article.findMany.mockResolvedValue([]);
});

describe("período común de reportes (RF-80)", () => {
  it("arma febrero bisiesto y un mes de 31 días", () => {
    const february = resolveReportPeriod({ year: "2024", month: "2" }, new Date(2026, 9, 19));
    expect(february.ok).toBe(true);
    if (!february.ok) return;
    expect(february.period.kind).toBe("month");
    expect(february.period.from.getDate()).toBe(1);
    expect(february.period.to.getDate()).toBe(29);
    expect(february.period.to.getMonth()).toBe(1);

    const october = resolveReportPeriod({ year: "2026", month: "10" }, new Date(2026, 9, 19));
    expect(october.ok).toBe(true);
    if (!october.ok) return;
    expect(october.period.to.getDate()).toBe(31);
  });

  it("por defecto usa el último mes calendario completo", () => {
    const result = resolveReportPeriod({}, new Date(2026, 9, 19));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.period.kind).toBe("month");
    expect(result.period.year).toBe(2026);
    expect(result.period.month).toBe(9);
    expect(result.period.from.getDate()).toBe(1);
    expect(result.period.to.getDate()).toBe(30);
    expect(result.period.label).toBe("septiembre 2026");
  });

  it("prioriza from/to y compara un rango libre con el mismo largo", () => {
    const result = resolveReportPeriod(
      { from: "2026-09-10", to: "2026-09-19", year: "2026", month: "1" },
      new Date(2026, 9, 19),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.period.kind).toBe("range");
    expect(result.period.from.getDate()).toBe(10);
    expect(result.period.to.getDate()).toBe(19);

    const previous = previousReportPeriod(result.period, "previous");
    expect(previous).not.toBeNull();
    expect(previous!.from.getMonth()).toBe(7); // agosto
    expect(previous!.from.getDate()).toBe(31);
    expect(previous!.to.getMonth()).toBe(8); // septiembre
    expect(previous!.to.getDate()).toBe(9);
  });

  it("compara un mes calendario contra el mes anterior completo", () => {
    const result = resolveReportPeriod(
      { from: "2026-09-01", to: "2026-09-30" },
      new Date(2026, 9, 19),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.period.kind).toBe("month");
    const previous = previousReportPeriod(result.period, "previous");
    expect(previous!.year).toBe(2026);
    expect(previous!.month).toBe(8);
    expect(previous!.from.getDate()).toBe(1);
    expect(previous!.to.getDate()).toBe(31);
  });

  it("rechaza un rango invertido", () => {
    const result = resolveReportPeriod({ from: "2026-09-30", to: "2026-09-01" });
    expect(result.ok).toBe(false);
  });

  it("paginación con tope de límite y modo all", () => {
    expect(parseReportPagination({ page: "2", limit: "500" })).toEqual({
      page: 2,
      limit: 100,
      all: false,
    });
    expect(parseReportPagination({ all: "true" })).toEqual({
      page: 1,
      limit: 25,
      all: true,
    });

    const all = paginate([1, 2, 3], { page: 1, limit: 1, all: true });
    expect(all.rows).toEqual([1, 2, 3]);
    expect(all.info.all).toBe(true);
    expect(all.info.total).toBe(3);
  });
});

describe("GET /api/reports/sales", () => {
  it("aplica vendedor, pago y totales además del período", async () => {
    prismaMock.sale.findMany.mockResolvedValue([
      {
        id: 10,
        userId: 2,
        total: 4000,
        paymentMethod: "EFECTIVO",
        createdAt: new Date("2026-09-15T14:30:00Z"),
        user: { id: 2, username: "vendedor" },
        items: [{ quantity: 2 }, { quantity: 1 }],
      },
    ]);

    const res = fakeRes();
    await salesReport(
      fakeReq({
        query: {
          from: "2026-09-01",
          to: "2026-09-30",
          userId: "2",
          paymentMethod: "EFECTIVO",
          minTotal: "1000",
          maxTotal: "5000",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    const where = prismaMock.sale.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(2);
    expect(where.paymentMethod).toBe("EFECTIVO");
    expect(where.total).toEqual({ gte: 1000, lte: 5000 });
    expect(where.createdAt.gte.getDate()).toBe(1);
    expect(where.createdAt.lte.getDate()).toBe(30);

    expect(res.body.summary.total).toBe(4000);
    expect(res.body.summary.units).toBe(3);
    expect(res.body.rows[0]).toMatchObject({
      seller: "vendedor",
      itemCount: 2,
      units: 3,
      total: 4000,
    });
    expect(res.body.groups.bySeller[0].seller).toBe("vendedor");
    expect(res.body.groups.byDay[0].date).toBe("2026-09-15");
  });

  it("devuelve la comparación con el período anterior", async () => {
    prismaMock.sale.findMany
      .mockResolvedValueOnce([
        {
          id: 10,
          userId: 1,
          total: 2000,
          paymentMethod: "TARJETA",
          createdAt: new Date("2026-09-15T14:30:00Z"),
          user: { id: 1, username: "admin" },
          items: [{ quantity: 1 }],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 9,
          userId: 1,
          total: 1000,
          paymentMethod: "TARJETA",
          createdAt: new Date("2026-08-15T14:30:00Z"),
          user: { id: 1, username: "admin" },
          items: [{ quantity: 1 }],
        },
      ]);

    const res = fakeRes();
    await salesReport(fakeReq({ query: { from: "2026-09-01", to: "2026-09-30" } }), res);

    expect(prismaMock.sale.findMany).toHaveBeenCalledTimes(2);
    const previousWhere = prismaMock.sale.findMany.mock.calls[1][0].where;
    expect(previousWhere.createdAt.gte.getMonth()).toBe(7); // agosto
    expect(previousWhere.createdAt.lte.getDate()).toBe(31);
    expect(res.body.previous.summary.total).toBe(1000);
    expect(res.body.previousPeriod.label).toBe("agosto 2026");
  });
});

describe("GET /api/reports/top-products", () => {
  it("calcula el margen con el costo guardado en la venta, no con el actual", async () => {
    prismaMock.article.findMany.mockResolvedValue([
      article({ purchasePrice: 1000, salePrice: 2000 }),
    ]);
    prismaMock.saleItem.findMany.mockResolvedValue([
      {
        articleCode: "FIL-001",
        articleName: "Filtro de aceite",
        quantity: 2,
        unitPrice: 2000,
        purchasePrice: 500,
      },
    ]);

    const res = fakeRes();
    await topProductsReport(
      fakeReq({
        query: {
          from: "2026-09-01",
          to: "2026-09-30",
          supplierId: "3",
          sortBy: "margin",
          compareWith: "none",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.rows[0]).toMatchObject({
      code: "FIL-001",
      units: 2,
      revenue: 4000,
      cost: 1000,
      margin: 3000,
      marginPct: 75,
    });
    expect(res.body.summary.margin).toBe(3000);
    expect(res.body.groups.byCategory[0].category).toBe("Filtros");
    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: { supplierId: 3 },
      include: { supplierInfo: true },
    });
  });

  it("con onlyWithSales=false incluye artículos sin ventas", async () => {
    prismaMock.article.findMany.mockResolvedValue([
      article({ code: "A", name: "Con venta" }),
      article({ code: "B", name: "Sin venta" }),
    ]);
    prismaMock.saleItem.findMany.mockResolvedValue([
      {
        articleCode: "A",
        articleName: "Con venta",
        quantity: 1,
        unitPrice: 2000,
        purchasePrice: 1000,
      },
    ]);

    const res = fakeRes();
    await topProductsReport(
      fakeReq({
        query: { from: "2026-09-01", to: "2026-09-30", onlyWithSales: "false" },
      }),
      res,
    );

    expect(res.body.rows).toHaveLength(2);
    expect(res.body.rows.find((row: any) => row.code === "B").units).toBe(0);
  });
});

describe("GET /api/reports/low-stock", () => {
  it("filtra por criticidad y calcula la reposición sugerida", async () => {
    prismaMock.article.findMany.mockResolvedValue([
      article({ code: "OUT", name: "Agotado", stock: 0, minStock: 5 }),
      article({ code: "CRI", name: "Crítico", stock: 1, minStock: 5 }),
      article({ code: "LOW", name: "Bajo", stock: 4, minStock: 5 }),
    ]);

    const res = fakeRes();
    await lowStockReport(
      fakeReq({ query: { criticality: "critical", compareWith: "none" } }),
      res,
    );

    expect(res.statusCode).toBe(200);
    const where = prismaMock.article.findMany.mock.calls[0][0].where;
    expect(where.stock.lte).toBe(minStockField);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0]).toMatchObject({
      code: "CRI",
      criticality: "critical",
      shortage: 4,
      suggestedOrder: 9,
      stockValue: 1000,
    });
    expect(res.body.summary).toMatchObject({
      articles: 1,
      critical: 1,
      out: 0,
      suggestedUnits: 9,
    });
    expect(res.body.groups.bySupplier[0].supplierName).toBe("Repuestos Norte");
    expect(res.body.previous).toBeNull();
  });

  it("includeZeroStock=false excluye los agotados y agrupa por proveedor", async () => {
    prismaMock.article.findMany.mockResolvedValue([
      article({ code: "OUT", name: "Agotado", stock: 0 }),
      article({ code: "CRI", name: "Crítico", stock: 1 }),
    ]);

    const res = fakeRes();
    await lowStockReport(
      fakeReq({ query: { includeZeroStock: "false", compareWith: "none" } }),
      res,
    );

    const where = prismaMock.article.findMany.mock.calls[0][0].where;
    expect(where.stock.gt).toBe(0);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].code).toBe("CRI");
  });
});

describe("GET /api/reports/purchases", () => {
  it("agrupa costo, valor de stock y stock parado por proveedor", async () => {
    prismaMock.article.findMany.mockResolvedValue([
      article({ code: "A", purchasePrice: 100, stock: 10, updatedAt: new Date("2026-09-10T12:00:00Z") }),
      article({ code: "B", purchasePrice: 50, stock: 4, updatedAt: new Date("2026-09-12T12:00:00Z") }),
    ]);
    prismaMock.saleItem.findMany.mockResolvedValue([
      { articleCode: "A", quantity: 1 },
    ]);

    const res = fakeRes();
    await purchasesReport(
      fakeReq({
        query: {
          from: "2026-09-01",
          to: "2026-09-30",
          onlyWithPurchases: "true",
          sortBy: "cost",
          compareWith: "none",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.rows[0]).toMatchObject({
      supplierName: "Repuestos Norte",
      articles: 2,
      purchasedArticles: 2,
      cost: 1200,
      stockValue: 1200,
      idleStockValue: 200,
      soldUnits: 1,
    });
    expect(res.body.summary).toMatchObject({
      suppliers: 1,
      purchasedArticles: 2,
      cost: 1200,
      idleStockValue: 200,
    });
  });

  it("onlyWithPurchases deja afuera proveedores sin movimientos en el rango", async () => {
    prismaMock.article.findMany.mockResolvedValue([
      article({ code: "A", updatedAt: new Date("2025-01-10T12:00:00Z") }),
    ]);

    const res = fakeRes();
    await purchasesReport(
      fakeReq({
        query: {
          from: "2026-09-01",
          to: "2026-09-30",
          onlyWithPurchases: "true",
          compareWith: "none",
        },
      }),
      res,
    );

    expect(res.body.rows).toEqual([]);
    expect(res.body.summary.purchasedArticles).toBe(0);
  });
});

describe("GET /api/reports/monthly", () => {
  it("devuelve los 12 meses con facturado, ventas y ticket promedio", async () => {
    prismaMock.sale.findMany.mockResolvedValue([
      {
        total: 1000,
        createdAt: new Date(2026, 0, 15, 10, 0, 0),
        items: [{ quantity: 2 }],
      },
      {
        total: 3000,
        createdAt: new Date(2026, 1, 10, 10, 0, 0),
        items: [{ quantity: 1 }],
      },
    ]);

    const res = fakeRes();
    await monthlyReport(fakeReq({ query: { year: "2026" } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.rows).toHaveLength(12);
    expect(res.body.rows[0]).toMatchObject({ month: 1, total: 1000, units: 2, avgTicket: 1000 });
    expect(res.body.rows[1]).toMatchObject({ month: 2, total: 3000, units: 1, avgTicket: 3000 });
    expect(res.body.summary).toMatchObject({ total: 4000, count: 2, units: 3 });
  });
});

describe("permisos de reportes", () => {
  it("un empleado recibe 403 en las rutas admin", () => {
    const res = fakeRes();
    const next = vi.fn();
    requireRole("ADMIN")(fakeReq({ user: { userId: 2, role: "EMPLOYEE" } }), res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Insufficient permissions" });
    expect(next).not.toHaveBeenCalled();
  });
});
