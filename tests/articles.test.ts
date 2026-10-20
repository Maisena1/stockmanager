import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, minStockField } = vi.hoisted(() => {
  const minStockField = { __field: "minStock" };
  const mock = {
    article: {
      findMany: vi.fn(),
      fields: { minStock: minStockField },
    },
    supplier: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  } as any;
  mock.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(mock));
  return { prismaMock: mock, minStockField };
});

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn() }));

import { list } from "../src/controllers/articles.controller";

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

const article = {
  code: "FIL-001",
  name: "Filtro",
  category: "Filtros",
  motorcycleModel: "Honda",
  purchasePrice: 1000,
  salePrice: 1300,
  stock: 2,
  minStock: 5,
  supplierId: 9,
  supplierInfo: { id: 9, name: "Motoparts" },
  barcode: null,
  photo: null,
  updatedAt: new Date("2026-10-10T12:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.article.findMany.mockReset();
  prismaMock.article.findMany.mockResolvedValue([]);
});

describe("GET /api/articles filtros", () => {
  it("combina proveedor, fechas y stock bajo, y ordena por updatedAt", async () => {
    prismaMock.article.findMany.mockResolvedValue([article]);

    const res = fakeRes();
    await list(
      fakeReq({
        query: {
          supplierId: "9",
          supplier: "Moto",
          updatedFrom: "2026-10-01",
          updatedTo: "2026-10-31",
          lowStock: "true",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: {
        supplierId: 9,
        supplierInfo: { is: { name: { contains: "Moto", mode: "insensitive" } } },
        updatedAt: { gte: expect.any(Date), lte: expect.any(Date) },
        stock: { lte: minStockField },
      },
      include: { supplierInfo: true },
      orderBy: [{ updatedAt: "desc" }, { code: "asc" }],
    });

    const where = prismaMock.article.findMany.mock.calls[0][0].where;
    expect(where.updatedAt.gte.getHours()).toBe(0);
    expect(where.updatedAt.lte.getHours()).toBe(23);
    expect(res.body[0].supplierName).toBe("Motoparts");
  });

  it("el buscador de texto libre también busca por proveedor", async () => {
    await list(fakeReq({ query: { q: "Motoparts" } }), fakeRes());

    const where = prismaMock.article.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { supplierInfo: { is: { name: { contains: "Motoparts", mode: "insensitive" } } } },
      ]),
    );
  });

  it("acepta params repetidos de Express 5 tomando el primero", async () => {
    await list(
      fakeReq({ query: { supplierId: ["9", "10"], lowStock: ["true"] } }),
      fakeRes(),
    );

    const where = prismaMock.article.findMany.mock.calls[0][0].where;
    expect(where.supplierId).toBe(9);
    expect(where.stock).toEqual({ lte: minStockField });
  });

  it("un empleado puede filtrar y nunca recibe costos", async () => {
    prismaMock.article.findMany.mockResolvedValue([article]);

    const res = fakeRes();
    await list(
      fakeReq({
        user: { userId: 2, role: "EMPLOYEE" },
        query: { supplierId: "9", lowStock: "true" },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body[0].supplierId).toBe(9);
    expect(res.body[0].supplierName).toBe("Motoparts");
    expect(res.body[0]).not.toHaveProperty("purchasePrice");
    expect(res.body[0]).not.toHaveProperty("minStock");
    expect(res.body[0]).toHaveProperty("updatedAt");
  });

  it("un admin sí recibe los costos", async () => {
    prismaMock.article.findMany.mockResolvedValue([article]);

    const res = fakeRes();
    await list(fakeReq(), res);

    expect(res.body[0].purchasePrice).toBe(1000);
    expect(res.body[0].minStock).toBe(5);
  });

  it("rechaza updatedFrom inválido", async () => {
    const res = fakeRes();
    await list(fakeReq({ query: { updatedFrom: "2026-02-31" } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("updatedFrom");
    expect(prismaMock.article.findMany).not.toHaveBeenCalled();
  });

  it("rechaza lowStock inválido", async () => {
    const res = fakeRes();
    await list(fakeReq({ query: { lowStock: "si" } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("lowStock");
    expect(prismaMock.article.findMany).not.toHaveBeenCalled();
  });

  it("rechaza supplierId no numérico", async () => {
    const res = fakeRes();
    await list(fakeReq({ query: { supplierId: "abc" } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("proveedor");
    expect(prismaMock.article.findMany).not.toHaveBeenCalled();
  });
});
