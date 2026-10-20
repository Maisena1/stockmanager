import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  importBatch: { findMany: vi.fn() },
}));

vi.mock("./prisma", () => ({ prisma: prismaMock }));

import {
  DEFAULT_IMPORT_DUP_COOLDOWN_MIN,
  findRecentDuplicate,
  getImportDupCooldownMin,
} from "./importBatches";

interface FakeBatch {
  id: number;
  userId: number;
  fileName: string;
  fileSize: number;
  createdAt: Date;
}

const now = new Date("2026-10-20T12:00:00Z");
const twoMB = 2.3 * 1024 * 1024;

function fakeDb(batches: FakeBatch[]) {
  prismaMock.importBatch.findMany.mockImplementation(
    async ({ where }: { where: { fileName: string; fileSize: number; createdAt: { gte: Date } } }) =>
      batches
        .filter(
          (batch) =>
            batch.fileName === where.fileName &&
            batch.fileSize === where.fileSize &&
            batch.createdAt >= where.createdAt.gte,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  );
}

const recent: FakeBatch = {
  id: 12,
  userId: 1,
  fileName: "pedido.xlsx",
  fileSize: twoMB,
  createdAt: new Date("2026-10-20T11:48:00Z"),
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getImportDupCooldownMin", () => {
  it("usa 30 por defecto si no está definido o está vacío", () => {
    const previous = process.env.IMPORT_DUP_COOLDOWN_MIN;
    delete process.env.IMPORT_DUP_COOLDOWN_MIN;
    expect(getImportDupCooldownMin()).toBe(DEFAULT_IMPORT_DUP_COOLDOWN_MIN);
    if (previous === undefined) delete process.env.IMPORT_DUP_COOLDOWN_MIN;
    else process.env.IMPORT_DUP_COOLDOWN_MIN = previous;

    vi.stubEnv("IMPORT_DUP_COOLDOWN_MIN", "");
    expect(getImportDupCooldownMin()).toBe(DEFAULT_IMPORT_DUP_COOLDOWN_MIN);
  });

  it("acepta un valor custom y 0", () => {
    vi.stubEnv("IMPORT_DUP_COOLDOWN_MIN", "5");
    expect(getImportDupCooldownMin()).toBe(5);

    vi.stubEnv("IMPORT_DUP_COOLDOWN_MIN", "0");
    expect(getImportDupCooldownMin()).toBe(0);
  });

  it("cae al default con valores inválidos o negativos", () => {
    vi.stubEnv("IMPORT_DUP_COOLDOWN_MIN", "abc");
    expect(getImportDupCooldownMin()).toBe(DEFAULT_IMPORT_DUP_COOLDOWN_MIN);

    vi.stubEnv("IMPORT_DUP_COOLDOWN_MIN", "-3");
    expect(getImportDupCooldownMin()).toBe(DEFAULT_IMPORT_DUP_COOLDOWN_MIN);
  });
});

describe("findRecentDuplicate", () => {
  it("encuentra el último lote con el mismo nombre y peso dentro del cooldown", async () => {
    fakeDb([recent]);

    const result = await findRecentDuplicate("pedido.xlsx", twoMB, now);

    expect(result).toMatchObject({
      batchId: 12,
      userId: 1,
      fileName: "pedido.xlsx",
      fileSize: twoMB,
      count: 1,
      cooldownMin: DEFAULT_IMPORT_DUP_COOLDOWN_MIN,
    });
    expect(prismaMock.importBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fileName: "pedido.xlsx",
          fileSize: twoMB,
          createdAt: { gte: new Date(now.getTime() - 30 * 60_000) },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("cuenta todas las coincidencias y devuelve la más reciente", async () => {
    fakeDb([
      recent,
      { ...recent, id: 13, createdAt: new Date("2026-10-20T11:55:00Z") },
    ]);

    const result = await findRecentDuplicate("pedido.xlsx", twoMB, now);
    expect(result?.batchId).toBe(13);
    expect(result?.count).toBe(2);
  });

  it("no matchea el mismo nombre con otro peso", async () => {
    fakeDb([recent]);
    expect(await findRecentDuplicate("pedido.xlsx", twoMB + 10, now)).toBeNull();
  });

  it("no matchea si pasó el cooldown", async () => {
    fakeDb([recent]);
    const later = new Date("2026-10-20T12:31:00Z");
    expect(await findRecentDuplicate("pedido.xlsx", twoMB, later)).toBeNull();
  });
});
