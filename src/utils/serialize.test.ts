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

  it("incluye el nombre del proveedor sin exponer sus datos de contacto", () => {
    const withSupplier = {
      ...fullArticle,
      supplierId: 7,
      supplierInfo: { id: 7, name: "Repuestos Norte", phone: "11 5555-5555" },
    };

    const admin = serializeArticle(withSupplier, "ADMIN");
    expect(admin.supplierId).toBe(7);
    expect(admin.supplierName).toBe("Repuestos Norte");
    expect(admin).not.toHaveProperty("supplierInfo");

    const employee = serializeArticle(withSupplier, "EMPLOYEE");
    expect(employee.supplierName).toBe("Repuestos Norte");
    expect(employee).not.toHaveProperty("supplierInfo");
    expect(employee).not.toHaveProperty("purchasePrice");
    expect(employee).not.toHaveProperty("minStock");
  });
});
