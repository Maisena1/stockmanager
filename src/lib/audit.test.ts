import { describe, it, expect } from "vitest";
import { parseAuditQuery, formatDetailMoney } from "./audit";

describe("parseAuditQuery", () => {
  it("devuelve filtros vacíos con valores por defecto", () => {
    const result = parseAuditQuery({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filters).toEqual({ where: {}, page: 1, pageSize: 20 });
  });

  it("convierte from/to a un rango de fechas local completo", () => {
    const result = parseAuditQuery({ from: "2026-10-01", to: "2026-10-15" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const range = result.filters.where.createdAt!;
    expect(range.gte).toEqual(new Date(2026, 9, 1));
    expect(range.lte).toEqual(new Date(2026, 9, 15, 23, 59, 59, 999));
  });

  it("rechaza fechas con formato inválido", () => {
    expect(parseAuditQuery({ from: "no-es-fecha" })).toEqual({
      ok: false,
      error: "Fecha 'from' inválida (usa el formato AAAA-MM-DD)",
    });
    expect(parseAuditQuery({ to: "2026/10/15" }).ok).toBe(false);
  });

  it("filtra por usuario sólo si es entero positivo", () => {
    const ok = parseAuditQuery({ userId: "7" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.filters.where.userId).toBe(7);

    expect(parseAuditQuery({ userId: "abc" }).ok).toBe(false);
    expect(parseAuditQuery({ userId: "-2" }).ok).toBe(false);
    expect(parseAuditQuery({ userId: "1.5" }).ok).toBe(false);
  });

  it("acepta sólo acciones conocidas por el enum", () => {
    const ok = parseAuditQuery({ action: "VENTA" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.filters.where.action).toBe("VENTA");

    const bad = parseAuditQuery({ action: "LOGIN" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain("VENTA");
  });

  it("aplica paginación con tope de 100 por página", () => {
    const ok = parseAuditQuery({ page: "3", pageSize: "50" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect({ page: ok.filters.page, pageSize: ok.filters.pageSize }).toEqual({ page: 3, pageSize: 50 });

    expect(parseAuditQuery({ page: "0" }).ok).toBe(false);
    expect(parseAuditQuery({ page: "abc" }).ok).toBe(false);
    expect(parseAuditQuery({ pageSize: "101" }).ok).toBe(false);
    expect(parseAuditQuery({ pageSize: "100" }).ok).toBe(true);
  });

  it("rechaza parámetros repetidos (arrays)", () => {
    const result = parseAuditQuery({ action: ["VENTA", "VENTA"] });
    expect(result).toEqual({ ok: false, error: "Parámetro inválido: action" });
  });
});

describe("formatDetailMoney", () => {
  it("formatea con separador de miles en español", () => {
    expect(formatDetailMoney(12400)).toBe("$12.400");
    expect(formatDetailMoney(0)).toBe("$0");
  });
});
