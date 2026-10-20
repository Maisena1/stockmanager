import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const prismaMock = vi.hoisted(() => {
  const mock = {
    article: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    supplier: { findFirst: vi.fn(), create: vi.fn() },
    importBatch: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  } as any;
  mock.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(mock));
  return mock;
});

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn() }));

import { preview, runImport } from "../src/controllers/import.controller";

const FILE_SIZE = 2.3 * 1024 * 1024;
const NOW = new Date("2026-10-20T12:00:00Z");
const EXISTING = {
  code: "FIL-001",
  name: "Filtro",
  stock: 10,
  purchasePrice: 100,
  salePrice: 200,
};

const BASE_CONFIG = {
  supplier: "Proveedor",
  motorcycleModel: "",
  percentage: 50,
  useExcelPrice: false,
  includeZeroRows: false,
  omitirFilasSinNombre: true,
  minStock: 0,
  defaultQuantity: 1,
  hasHeader: true,
  columns: {
    code: null,
    name: 0,
    category: 1,
    motorcycleModel: 2,
    purchasePrice: 3,
    salePrice: null,
    stock: 4,
    barcode: 5,
  },
  confirmDuplicate: false,
};

interface FakeBatch {
  id: number;
  userId: number;
  fileName: string;
  fileSize: number;
  report: unknown;
  createdAt: Date;
}

let batches: FakeBatch[] = [];
let nextBatchId = 12;

function installBatchStore() {
  prismaMock.importBatch.create.mockImplementation(
    async ({ data }: { data: Omit<FakeBatch, "id" | "createdAt"> }) => {
      const batch: FakeBatch = { id: nextBatchId++, ...data, createdAt: new Date() };
      batches.push(batch);
      return batch;
    },
  );

  prismaMock.importBatch.findMany.mockImplementation(
    async ({
      where,
    }: {
      where: { fileName: string; fileSize?: number; createdAt?: { gte: Date } };
    }) =>
      batches
        .filter(
          (batch) =>
            batch.fileName === where.fileName &&
            (where.fileSize === undefined || batch.fileSize === where.fileSize) &&
            (!where.createdAt?.gte || batch.createdAt >= where.createdAt.gte),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  );
}

function workbookBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Nombre", "Categoría", "Modelo", "Compra", "Stock", "Barras"],
    ["Filtro", "Filtros", "Honda", 100, 5, ""],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function fakeFile(size = FILE_SIZE) {
  return {
    originalname: "pedido.xlsx",
    size,
    buffer: workbookBuffer(),
    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fieldname: "file",
    encoding: "7bit",
  };
}

function request(options: {
  file?: ReturnType<typeof fakeFile>;
  config?: Record<string, unknown>;
  sheets?: string[];
} = {}) {
  return {
    file: options.file ?? fakeFile(),
    body: {
      config: JSON.stringify({ ...BASE_CONFIG, ...(options.config ?? {}) }),
      sheets: JSON.stringify(options.sheets ?? ["Hoja1"]),
    },
    user: { userId: 1, role: "ADMIN" },
  } as any;
}

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
  return res;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();

  batches = [];
  nextBatchId = 12;
  installBatchStore();

  prismaMock.article.findMany.mockResolvedValue([EXISTING]);
  prismaMock.article.create.mockImplementation(async ({ data }: any) => data);
  prismaMock.article.update.mockResolvedValue(EXISTING);
  prismaMock.supplier.findFirst.mockResolvedValue({ id: 5, name: "Proveedor" });
  prismaMock.supplier.create.mockImplementation(async ({ data }: any) => ({ id: 6, ...data }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("runImport — control de duplicados", () => {
  it("importar dos veces el mismo archivo da 409", async () => {
    const first = fakeRes();
    await runImport(request(), first);
    expect(first.statusCode).toBe(201);
    expect(first.body.imported).toBe(true);
    expect(first.body.batchId).toBe(12);

    vi.setSystemTime(new Date("2026-10-20T12:12:00Z"));

    const second = fakeRes();
    await runImport(request(), second);

    expect(second.statusCode).toBe(409);
    expect(second.body.imported).toBe(false);
    expect(second.body.error).toContain("pedido.xlsx");
    expect(second.body.error).toContain("2.3 MB");
    expect(second.body.error).toContain("hace 12 min");
    expect(second.body.error).toContain("importación #12");
    expect(second.body.error).toContain("1 vez");
    expect(second.body.duplicate.batchId).toBe(12);
    expect(second.body.duplicate.count).toBe(1);

    // El 409 corta antes de tocar artículos o la transacción.
    expect(prismaMock.article.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.importBatch.create).toHaveBeenCalledTimes(1);
  });

  it("con confirmDuplicate pasa y deja warning en el reporte", async () => {
    const first = fakeRes();
    await runImport(request(), first);
    expect(first.statusCode).toBe(201);

    vi.setSystemTime(new Date("2026-10-20T12:05:00Z"));

    const second = fakeRes();
    await runImport(request({ config: { confirmDuplicate: true } }), second);

    expect(second.statusCode).toBe(201);
    expect(second.body.report.warnings).toHaveLength(1);
    expect(second.body.report.warnings[0]).toContain("Se importó igualmente");
    expect(second.body.report.warnings[0]).toContain("importación #12");
    expect(second.body.batchId).toBe(13);

    expect(prismaMock.importBatch.create).toHaveBeenCalledTimes(2);
    const secondBatch = prismaMock.importBatch.create.mock.calls[1][0].data;
    expect(secondBatch.userId).toBe(1);
    expect(secondBatch.fileName).toBe("pedido.xlsx");
    expect(secondBatch.fileSize).toBe(FILE_SIZE);
    expect(secondBatch.report.warnings).toHaveLength(1);
  });

  it("mismo nombre con otro peso pasa sin 409", async () => {
    const first = fakeRes();
    await runImport(request({ file: fakeFile(FILE_SIZE) }), first);
    expect(first.statusCode).toBe(201);

    const second = fakeRes();
    await runImport(request({ file: fakeFile(FILE_SIZE + 1024) }), second);

    expect(second.statusCode).toBe(201);
    expect(second.body.report.warnings).toBeUndefined();
    expect(prismaMock.importBatch.create).toHaveBeenCalledTimes(2);
  });

  it("pasado el cooldown pasa sin 409", async () => {
    const first = fakeRes();
    await runImport(request(), first);
    expect(first.statusCode).toBe(201);

    vi.setSystemTime(new Date("2026-10-20T12:31:00Z"));

    const second = fakeRes();
    await runImport(request(), second);

    expect(second.statusCode).toBe(201);
    expect(second.body.report.warnings).toBeUndefined();
    expect(prismaMock.importBatch.create).toHaveBeenCalledTimes(2);
  });

  it("registra el lote con el reporte de creados/actualizados/salteados", async () => {
    const res = fakeRes();
    await runImport(request(), res);

    expect(res.statusCode).toBe(201);
    const data = prismaMock.importBatch.create.mock.calls[0][0].data;
    expect(data.userId).toBe(1);
    expect(data.fileName).toBe("pedido.xlsx");
    expect(data.fileSize).toBe(FILE_SIZE);
    expect(data.report).toMatchObject({
      created: 0,
      updated: 1,
      skipped: 0,
      errors: [],
    });
  });
});

describe("preview — importaciones previas", () => {
  it("devuelve previousImports y duplicate para el mismo nombre y peso", async () => {
    await runImport(request(), fakeRes());
    vi.setSystemTime(new Date("2026-10-20T12:12:00Z"));

    const res = fakeRes();
    await preview(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sheets).toHaveLength(1);
    expect(res.body.previousImports).toHaveLength(1);
    expect(res.body.previousImports[0].id).toBe(12);
    expect(res.body.previousImports[0].fileSize).toBe(FILE_SIZE);
    expect(res.body.duplicate.batchId).toBe(12);
    expect(res.body.duplicate.message).toContain("hace 12 min");
  });

  it("con otro peso devuelve historial pero duplicate null", async () => {
    await runImport(request(), fakeRes());

    const res = fakeRes();
    await preview(request({ file: fakeFile(FILE_SIZE + 1024) }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.previousImports).toHaveLength(1);
    expect(res.body.duplicate).toBeNull();
  });
});
