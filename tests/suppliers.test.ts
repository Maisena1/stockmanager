import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock = {
    supplier: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    article: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    sale: { count: vi.fn() },
    saleItem: { count: vi.fn() },
    auditLog: {
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
  mock.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(mock));
  return mock;
});

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn() }));

import {
  create as createSupplier,
  impact as supplierImpact,
  list as listSuppliers,
  remove as removeSupplier,
  update as updateSupplier,
} from "../src/controllers/supplier.controller";
import { create as createArticle, update as updateArticle } from "../src/controllers/articles.controller";
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

const supplier = {
  id: 3,
  name: "Repuestos Norte",
  phone: "11 5555-5555",
  email: "ventas@norte.com",
  notes: "Contacto: Ana",
  createdAt: new Date("2026-10-01T12:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of ["supplier", "article", "sale", "saleItem", "auditLog"] as const) {
    for (const method of Object.keys(prismaMock[model])) {
      prismaMock[model][method].mockReset();
    }
  }
  prismaMock.$transaction.mockReset();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(prismaMock));
});

describe("GET /api/suppliers", () => {
  it("lista proveedores con la cantidad de artículos", async () => {
    prismaMock.supplier.findMany.mockResolvedValue([
      { ...supplier, _count: { articles: 4 } },
    ]);

    const res = fakeRes();
    await listSuppliers(fakeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body[0]).toMatchObject({
      id: 3,
      name: "Repuestos Norte",
      articleCount: 4,
    });
    expect(res.body[0]).not.toHaveProperty("_count");
  });
});

describe("POST /api/suppliers", () => {
  it("crea un proveedor válido y audita la acción", async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    prismaMock.supplier.create.mockResolvedValue(supplier);

    const res = fakeRes();
    await createSupplier(
      fakeReq({
        body: {
          name: "  Repuestos   Norte ",
          phone: "11 5555-5555",
          email: "ventas@norte.com",
          notes: "Contacto: Ana",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(prismaMock.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Repuestos Norte" }),
      }),
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "PROVEEDOR_CREADO" }),
    );
  });

  it("rechaza un nombre duplicado sin distinguir mayúsculas", async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(supplier);

    const res = fakeRes();
    await createSupplier(fakeReq({ body: { name: "repuestos norte" } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Ya existe");
    expect(prismaMock.supplier.create).not.toHaveBeenCalled();
  });

  it("rechaza un email inválido", async () => {
    const res = fakeRes();
    await createSupplier(
      fakeReq({ body: { name: "Nuevo", email: "no-es-email" } }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("email");
    expect(prismaMock.supplier.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/suppliers/:id", () => {
  it("edita el proveedor y sincroniza el nombre legacy de sus artículos", async () => {
    prismaMock.supplier.findUnique.mockResolvedValue(supplier);
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    prismaMock.supplier.update.mockResolvedValue({ ...supplier, name: "Norte Repuestos" });

    const res = fakeRes();
    await updateSupplier(
      fakeReq({ params: { id: "3" }, body: { name: "Norte Repuestos" } }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(prismaMock.article.updateMany).toHaveBeenCalledWith({
      where: { supplierId: 3 },
      data: { supplier: "Norte Repuestos" },
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "PROVEEDOR_ACTUALIZADO" }),
    );
  });
});

describe("GET /api/suppliers/:id/impact", () => {
  it("informa artículos, ventas e ítems afectados", async () => {
    prismaMock.supplier.findUnique.mockResolvedValue({ id: 3, name: supplier.name });
    prismaMock.article.count.mockResolvedValue(5);
    prismaMock.sale.count.mockResolvedValue(2);
    prismaMock.saleItem.count.mockResolvedValue(7);

    const res = fakeRes();
    await supplierImpact(fakeReq({ params: { id: "3" } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: 3,
      name: "Repuestos Norte",
      articles: 5,
      sales: 2,
      saleItems: 7,
      canDelete: true,
    });
  });
});

describe("DELETE /api/suppliers/:id", () => {
  it("borra en cascada siempre, incluso con ventas asociadas", async () => {
    prismaMock.supplier.findUnique.mockResolvedValue(supplier);
    prismaMock.article.count.mockResolvedValue(3);
    prismaMock.sale.count.mockResolvedValue(2);
    prismaMock.saleItem.count.mockResolvedValue(6);
    prismaMock.supplier.delete.mockResolvedValue(supplier);

    const res = fakeRes();
    await removeSupplier(fakeReq({ params: { id: "3" } }), res);

    expect(res.statusCode).toBe(204);
    expect(prismaMock.supplier.delete).toHaveBeenCalledWith({ where: { id: 3 } });
    const audit = (logAudit as any).mock.calls[0][1];
    expect(audit.action).toBe("PROVEEDOR_ELIMINADO");
    expect(audit.detail).toContain("Repuestos Norte");
    expect(audit.detail).toContain("3 artículo(s)");
    expect(audit.detail).toContain("historial de ventas conservado: 2");
    // La auditoría es histórica: nunca se borra al eliminar el proveedor.
    expect(prismaMock.auditLog.delete).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.deleteMany).not.toHaveBeenCalled();
  });
});

describe("Artículos con proveedor", () => {
  it("crea un artículo con un proveedor válido", async () => {
    prismaMock.supplier.findUnique.mockResolvedValue({ id: 9, name: "Motoparts" });
    prismaMock.article.findMany.mockResolvedValue([]);
    prismaMock.article.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      supplierInfo: { id: 9, name: "Motoparts" },
    }));

    const res = fakeRes();
    await createArticle(
      fakeReq({
        body: {
          name: "Filtro",
          category: "Filtros",
          motorcycleModel: "Honda",
          purchasePrice: 1000,
          percentage: 30,
          stock: 2,
          minStock: 1,
          supplierId: 9,
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.supplierId).toBe(9);
    expect(res.body.supplierName).toBe("Motoparts");
    expect(res.body.supplier).toBe("Motoparts");
  });

  it("rechaza un artículo con proveedor inexistente", async () => {
    prismaMock.supplier.findUnique.mockResolvedValue(null);

    const res = fakeRes();
    await createArticle(
      fakeReq({
        body: {
          name: "Filtro",
          category: "Filtros",
          motorcycleModel: "Honda",
          purchasePrice: 1000,
          percentage: 30,
          stock: 2,
          minStock: 1,
          supplierId: 999,
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("no existe");
    expect(prismaMock.article.create).not.toHaveBeenCalled();
  });

  it("actualiza un artículo con proveedor válido", async () => {
    prismaMock.article.findUnique.mockResolvedValue({
      code: "FIL-001",
      purchasePrice: 1000,
      salePrice: 1300,
    });
    prismaMock.supplier.findUnique.mockResolvedValue({ id: 9, name: "Motoparts" });
    prismaMock.article.update.mockImplementation(async ({ data }: any) => ({
      code: "FIL-001",
      ...data,
      supplierInfo: { id: 9, name: "Motoparts" },
    }));

    const res = fakeRes();
    await updateArticle(
      fakeReq({ params: { code: "FIL-001" }, body: { supplierId: 9 } }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(prismaMock.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ supplierId: 9, supplier: "Motoparts" }),
      }),
    );
  });

  it("rechaza una actualización con proveedor inexistente", async () => {
    prismaMock.article.findUnique.mockResolvedValue({
      code: "FIL-001",
      purchasePrice: 1000,
      salePrice: 1300,
    });
    prismaMock.supplier.findUnique.mockResolvedValue(null);

    const res = fakeRes();
    await updateArticle(
      fakeReq({ params: { code: "FIL-001" }, body: { supplierId: 404 } }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(prismaMock.article.update).not.toHaveBeenCalled();
  });
});
