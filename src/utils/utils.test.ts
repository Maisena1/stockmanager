import { describe, it, expect } from "vitest";
import { calculateSalePrice } from "./precio";
import { normalizeUpperCase } from "./normalizar";

describe("calculateSalePrice", () => {
  it("rounds up to nearest 100", () => {
    expect(calculateSalePrice(2500, 60)).toBe(4000);
  });

  it("rounds up when result is not a multiple of 100", () => {
    expect(calculateSalePrice(1000, 45)).toBe(1500);
  });

  it("stays same when already a multiple of 100", () => {
    expect(calculateSalePrice(2000, 50)).toBe(3000);
  });

  it("handles zero percentage", () => {
    expect(calculateSalePrice(1500, 0)).toBe(1500);
  });

  it("handles large values", () => {
    expect(calculateSalePrice(50000, 30)).toBe(65000);
  });

  it("handles small values", () => {
    expect(calculateSalePrice(100, 10)).toBe(200);
  });
});

describe("normalizeUpperCase", () => {
  it("converts to uppercase", () => {
    expect(normalizeUpperCase("filtro")).toBe("FILTRO");
  });

  it("removes accents", () => {
    expect(normalizeUpperCase("último")).toBe("ULTIMO");
  });

  it("handles mixed case with accents", () => {
    expect(normalizeUpperCase("Filtro de aceite")).toBe("FILTRO DE ACEITE");
  });

  it("handles empty string", () => {
    expect(normalizeUpperCase("")).toBe("");
  });

  it("preserves numbers and special chars", () => {
    expect(normalizeUpperCase("123-abc!")).toBe("123-ABC!");
  });
});
