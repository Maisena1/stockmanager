import { describe, expect, it } from "vitest";
import {
  buildDuplicateMessage,
  buildDuplicateWarning,
  formatFileSize,
  formatTimeAgo,
  type DuplicateImport,
} from "./importBatches";

const now = new Date("2026-10-20T12:00:00Z");

function duplicate(overrides: Partial<DuplicateImport> = {}): DuplicateImport {
  return {
    batchId: 12,
    userId: 1,
    fileName: "pedido.xlsx",
    fileSize: 2.3 * 1024 * 1024,
    createdAt: new Date("2026-10-20T11:48:00Z"),
    count: 1,
    cooldownMin: 30,
    ...overrides,
  };
}

describe("formatFileSize", () => {
  it("formatea MB, KB y bytes", () => {
    expect(formatFileSize(2.3 * 1024 * 1024)).toBe("2.3 MB");
    expect(formatFileSize(512 * 1024)).toBe("512 KB");
    expect(formatFileSize(12)).toBe("12 B");
  });
});

describe("formatTimeAgo", () => {
  it("usa minutos, horas y días", () => {
    expect(formatTimeAgo(new Date("2026-10-20T11:59:30Z"), now)).toBe("hace menos de 1 min");
    expect(formatTimeAgo(new Date("2026-10-20T11:48:00Z"), now)).toBe("hace 12 min");
    expect(formatTimeAgo(new Date("2026-10-20T10:00:00Z"), now)).toBe("hace 2 h");
    expect(formatTimeAgo(new Date("2026-10-18T12:00:00Z"), now)).toBe("hace 2 días");
  });
});

describe("buildDuplicateMessage", () => {
  it("nombra archivo, peso, tiempo, cantidad y lote", () => {
    const message = buildDuplicateMessage(duplicate(), 1, now);
    expect(message).toContain("Ya importaste");
    expect(message).toContain('"pedido.xlsx"');
    expect(message).toContain("2.3 MB");
    expect(message).toContain("hace 12 min");
    expect(message).toContain("importación #12");
    expect(message).toContain("1 vez");
    expect(message).toContain("últimos 30 min");
    expect(message).toContain("confirmá la duplicación");
  });

  it("distingue cuando el último lote es de otro usuario", () => {
    const message = buildDuplicateMessage(duplicate({ userId: 2 }), 1, now);
    expect(message).toContain("Ya se importó");
    expect(message).not.toContain("Ya importaste");
  });

  it("pluraliza la cantidad de importaciones", () => {
    const message = buildDuplicateMessage(duplicate({ count: 3 }), 1, now);
    expect(message).toContain("3 veces");
  });
});

describe("buildDuplicateWarning", () => {
  it("habla en pasado porque la importación ya se hizo", () => {
    const warning = buildDuplicateWarning(duplicate(), now);
    expect(warning).toContain("Se importó igualmente");
    expect(warning).toContain('"pedido.xlsx"');
    expect(warning).toContain("hace 12 min");
    expect(warning).toContain("importación #12");
    expect(warning).not.toContain("Estás por duplicar");
  });
});
