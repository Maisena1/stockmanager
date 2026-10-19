import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock = {
    article: { findMany: vi.fn(), update: vi.fn() },
    sale: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  } as any;
  mock.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(mock));
  return mock;
});

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/audit", () => ({
  logAudit: vi.fn(),
  formatDetailMoney: (n: number) => `$${n}`,
}));

import { createSale, listSales } from "../src/controllers/sales.controller";
import { logAudit } from "../src/lib/audit";

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
  name: "Filtro de aceite",
  salePrice: 4000,
  stock: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.article.findMany.mockReset();
  prismaMock.article.update.mockReset();
  prismaMock.sale.create.mockReset();
  prismaMock.sale.findMany.mockReset();
  prismaMock.$transaction.mockReset();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(prismaMock));
});

describe("createSale", () => {
  it("guarda el nombre del artículo como snapshot en cada ítem", async () => {
    prismaMock.article.findMany.mockResolvedValue([article]);
    prismaMock.article.update.mockResolvedValue(article);
    prismaMock.sale.create.mockImplementation(async ({ data }: any) => ({
      id: 42,
      userId: data.userId,
      total: data.total,
      paymentMethod: data.paymentMethod,
      items: data.items.create.map((i: any, idx: number) => ({
        id: idx + 1,
        saleId: 42,
        ...i,
      })),
    }));

    const res = fakeRes();
    await createSale(
      fakeReq({
        body: {
          items: [{ articleCode: "FIL-001", quantity: 2 }],
          paymentMethod: "EFECTIVO",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(prismaMock.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                articleCode: "FIL-001",
                articleName: "Filtro de aceite",
                quantity: 2,
              }),
            ],
          },
        }),
      }),
    );

    // El detalle de auditoría usa el snapshot, no la relación con Article.
    const audit = (logAudit as any).mock.calls[0][1];
    expect(audit.action).toBe("VENTA");
    expect(audit.detail).toContain("Filtro de aceite x2");
  });
});

describe("listSales", () => {
  it("devuelve articleName aunque el artículo ya no exista", async () => {
    prismaMock.sale.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 1,
        total: 4000,
        paymentMethod: "EFECTIVO",
        createdAt: new Date(),
        user: { username: "admin" },
        items: [
          {
            id: 1,
            saleId: 1,
            articleCode: null,
            articleName: "Filtro de aceite",
            quantity: 1,
            unitPrice: 4000,
            total: 4000,
          },
        ],
      },
    ]);

    const res = fakeRes();
    await listSales(fakeReq({ query: {} }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body[0].items[0].articleName).toBe("Filtro de aceite");
    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ items: true }),
      }),
    );
  });
});
