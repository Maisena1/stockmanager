import { describe, it, expect } from "vitest";
import { serializeArticle } from "./serialize";

const fullArticle = {
  code: "FIL-001",
  name: "Oil Filter",
  category: "Filters",
  motorcycleModel: "Honda CG 150",
  purchasePrice: 2500,
  salePrice: 4000,
  stock: 50,
  minStock: 10,
  supplier: "Repuestos Norte",
  barcode: null as string | null,
  photo: null as string | null,
};

describe("serializeArticle", () => {
  it("returns all fields for ADMIN", () => {
    const result = serializeArticle(fullArticle, "ADMIN") as typeof fullArticle;
    expect(result).toEqual(fullArticle);
    expect(result.purchasePrice).toBe(2500);
    expect(result.minStock).toBe(10);
  });

  it("hides purchasePrice and minStock for EMPLOYEE", () => {
    const result = serializeArticle(fullArticle, "EMPLOYEE");
    expect(result.code).toBe("FIL-001");
    expect(result.name).toBe("Oil Filter");
    expect(result.salePrice).toBe(4000);
    expect(result.stock).toBe(50);
    expect(result).not.toHaveProperty("purchasePrice");
    expect(result).not.toHaveProperty("minStock");
  });
});
