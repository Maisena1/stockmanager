import { describe, it, expect } from "vitest";
import {
  buildPlan,
  parseSettings,
  parseSheetNames,
  selectSheets,
  summarize,
  type ExistingArticle,
  type ImportSettings,
  type SheetData,
} from "./importar";

function settings(overrides: Partial<ImportSettings> = {}): ImportSettings {
  return {
    supplier: "Repuestos Norte",
    motorcycleModel: "",
    percentage: 50,
    useExcelPrice: false,
    includeZeroRows: false,
    minStock: 5,
    defaultQuantity: 1,
    columns: {
      code: 0,
      name: 1,
      category: 2,
      motorcycleModel: 3,
      purchasePrice: 4,
      salePrice: 5,
      stock: 6,
      barcode: 7,
    },
    existing: "skip",
    hasHeader: true,
    ...overrides,
  };
}

// Columnas sin código: el nombre pasa a ser la columna 0.
function simpleColumns(): ImportSettings["columns"] {
  return {
    code: null,
    name: 0,
    category: 1,
    motorcycleModel: 2,
    purchasePrice: 3,
    salePrice: 4,
    stock: 5,
    barcode: 6,
  };
}

const sheet: SheetData = {
  name: "Stock",
  rows: [
    ["codigo", "nombre", "categoria", "modelo", "costo", "venta", "stock", "barcode"],
    ["FIL-001", "Filtro de aceite", "Filtros", "Honda CG 150", 2500, 4000, 10, "7791"],
    ["BUI-002", "Bujía NGK", "Encendido", "Yamaha FZ 16", "1.800,50", "", 3, ""],
  ],
};

const emptyExisting = new Map<string, ExistingArticle>();

describe("parseSettings", () => {
  it("acepta un objeto plano", () => {
    const result = parseSettings({
      supplier: "Norte",
      percentage: 40,
      existing: "sumStock",
      columns: { name: 1, purchasePrice: 4, stock: 6 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.supplier).toBe("Norte");
    expect(result.settings.percentage).toBe(40);
    expect(result.settings.existing).toBe("sumStock");
    expect(result.settings.minStock).toBe(0);
    expect(result.settings.defaultQuantity).toBe(1);
    expect(result.settings.hasHeader).toBe(true);
  });

  it("acepta un JSON en string (campo de formulario multipart)", () => {
    const result = parseSettings(
      JSON.stringify({ supplier: "Norte", percentage: 30, existing: "skip" }),
    );
    expect(result.ok).toBe(true);
  });

  it("acepta columnas y booleanos como strings", () => {
    const result = parseSettings({
      supplier: "Norte",
      percentage: 30,
      existing: "skip",
      includeZeroRows: "true",
      hasHeader: "false",
      columns: { name: "2", purchasePrice: "5" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.columns.name).toBe(2);
    expect(result.settings.columns.purchasePrice).toBe(5);
    expect(result.settings.includeZeroRows).toBe(true);
    expect(result.settings.hasHeader).toBe(false);
  });

  it("rechaza falta de proveedor", () => {
    expect(parseSettings({ percentage: 30, existing: "skip" })).toEqual({
      ok: false,
      error: "El proveedor es obligatorio",
    });
  });

  it("rechaza porcentaje inválido o negativo", () => {
    expect(parseSettings({ supplier: "N", existing: "skip" }).ok).toBe(false);
    expect(parseSettings({ supplier: "N", percentage: -5, existing: "skip" }).ok).toBe(false);
  });

  it("rechaza stock mínimo o cantidad estándar negativos", () => {
    expect(parseSettings({ supplier: "N", percentage: 1, existing: "skip", minStock: -1 }).ok).toBe(false);
    expect(
      parseSettings({ supplier: "N", percentage: 1, existing: "skip", defaultQuantity: -2 }).ok,
    ).toBe(false);
  });

  it("rechaza política de artículos existentes desconocida", () => {
    expect(parseSettings({ supplier: "N", percentage: 10, existing: "borrar" }).ok).toBe(false);
  });

  it("rechaza usar precio del Excel sin mapear la columna de venta", () => {
    expect(
      parseSettings({
        supplier: "N",
        percentage: 10,
        existing: "skip",
        useExcelPrice: true,
        columns: { name: 1, purchasePrice: 4, salePrice: null },
      }),
    ).toEqual({
      ok: false,
      error: "Para usar el precio del Excel hay que mapear la columna de precio de venta",
    });
  });

  it("rechaza JSON inválido", () => {
    expect(parseSettings("{no es json")).toEqual({
      ok: false,
      error: "La configuración no es un JSON válido",
    });
  });

  it("rechaza configuración ausente o vacía", () => {
    const expected = { ok: false, error: "Falta la configuración de importación" };
    expect(parseSettings(undefined)).toEqual(expected);
    expect(parseSettings(null)).toEqual(expected);
    expect(parseSettings("")).toEqual(expected);
    expect(parseSettings("undefined")).toEqual(expected);
  });
});

describe("parseSheetNames", () => {
  it("devuelve null cuando no se envió nada", () => {
    expect(parseSheetNames(undefined)).toBeNull();
    expect(parseSheetNames("")).toBeNull();
    expect(parseSheetNames("undefined")).toBeNull();
    expect(parseSheetNames([])).toBeNull();
  });

  it("acepta un array", () => {
    expect(parseSheetNames(["Stock", " Extra "])).toEqual(["Stock", "Extra"]);
  });

  it("acepta un JSON en string", () => {
    expect(parseSheetNames('["Stock","Extra"]')).toEqual(["Stock", "Extra"]);
  });

  it("acepta una lista separada por comas", () => {
    expect(parseSheetNames("Stock, Extra")).toEqual(["Stock", "Extra"]);
  });

  it("devuelve null con un JSON roto en vez de Romper", () => {
    expect(parseSheetNames('["Stock"')).toBeNull();
  });
});

describe("selectSheets", () => {
  const sheets: SheetData[] = [
    { name: "Stock", rows: [] },
    { name: "Extra", rows: [] },
  ];

  it("devuelve todas si no se selecciona ninguna", () => {
    expect(selectSheets(sheets)).toHaveLength(2);
    expect(selectSheets(sheets, [])).toHaveLength(2);
  });

  it("filtra por nombre", () => {
    expect(selectSheets(sheets, ["Extra"]).map((s) => s.name)).toEqual(["Extra"]);
  });
});

describe("buildPlan", () => {
  it("saltea la fila de encabezado y crea el resto", () => {
    const plan = buildPlan([sheet], settings(), emptyExisting);
    expect(plan.errors).toEqual([]);
    expect(plan.toCreate).toHaveLength(2);
    expect(plan.skipped).toEqual([]);
  });

  it("calcula el precio de venta redondeando a 100 cuando hay que recalcular", () => {
    const plan = buildPlan([sheet], settings({ percentage: 60 }), emptyExisting);
    expect(plan.toCreate[0].row.purchasePrice).toBe(2500);
    expect(plan.toCreate[0].row.salePrice).toBe(4000);
  });

  it("usa el precio de venta del Excel cuando useExcelPrice está activo", () => {
    const plan = buildPlan([sheet], settings({ useExcelPrice: true }), emptyExisting);
    expect(plan.toCreate[0].row.salePrice).toBe(4000);
  });

  it("lee precios con separador de miles y coma decimal", () => {
    const plan = buildPlan([sheet], settings(), emptyExisting);
    const second = plan.toCreate[1].row;
    expect(second.purchasePrice).toBe(1800.5);
    expect(second.salePrice).toBe(2800);
  });

  it("lee distintos formatos numéricos de Excel", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [
        ["nombre", "costo"],
        ["A", 2500],
        ["B", "2.500"],
        ["C", "1.800,50"],
        ["D", "12,50"],
        ["E", "1,500"],
        ["F", "$3.200"],
        ["G", "12.5"],
        ["H", "texto"],
        ["I", ""],
      ],
    };
    const plan = buildPlan([data], settings({ columns: { name: 0, purchasePrice: 1 } }), emptyExisting);
    const costs = plan.toCreate.map((entry) => entry.row.purchasePrice);
    expect(costs).toEqual([2500, 2500, 1800.5, 12.5, 1500, 3200, 12.5]);
    // "texto" y "" no son números: quedan como 0 y se saltean por includeZeroRows.
    expect(plan.skipped).toHaveLength(2);
  });

  it("usa la cantidad estándar cuando la columna stock está vacía", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [["nombre", "categoria", "modelo", "costo", "venta", "stock"], ["Bujía", "Encendido", "FZ 16", 1000, 1500, ""]],
    };
    const plan = buildPlan(
      [data],
      settings({ defaultQuantity: 7, columns: simpleColumns() }),
      emptyExisting,
    );
    expect(plan.toCreate[0].row.stock).toBe(7);
  });

  it("omite la columna de código si no está mapeada", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [["nombre", "categoria", "modelo", "costo", "venta", "stock"], ["Bujía NGK", "", "", 1000, 1500, 4]],
    };
    const plan = buildPlan([data], settings({ columns: simpleColumns() }), emptyExisting);
    expect(plan.toCreate[0].code).toBeNull();
  });

  it("saltea filas con precio o cantidad 0 cuando includeZeroRows es false", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [
        ["nombre", "categoria", "modelo", "costo", "venta", "stock"],
        ["Gratis", "", "", 0, 0, 5],
        ["Sin stock", "", "", 100, 100, 0],
      ],
    };
    const plan = buildPlan([data], settings({ columns: simpleColumns() }), emptyExisting);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.skipped).toHaveLength(2);
    expect(plan.skipped[0].reason).toBe("Fila con precio o cantidad en 0");
  });

  it("incluye filas con 0 cuando includeZeroRows es true", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [["nombre", "categoria", "modelo", "costo", "venta", "stock"], ["Gratis", "", "", 0, 0, 5]],
    };
    const plan = buildPlan(
      [data],
      settings({ includeZeroRows: true, columns: simpleColumns() }),
      emptyExisting,
    );
    expect(plan.toCreate).toHaveLength(1);
  });

  it("reporta error por fila cuando falta el nombre", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [["nombre", "categoria", "modelo", "costo", "venta", "stock"], ["", "", "", 100, 100, 1]],
    };
    const plan = buildPlan([data], settings({ columns: simpleColumns() }), emptyExisting);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.errors).toEqual([
      { sheet: "Stock", row: 2, message: "Falta el nombre del artículo" },
    ]);
  });

  it("reporta error por fila con cantidades negativas", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [["nombre", "categoria", "modelo", "costo", "venta", "stock"], ["Algo", "", "", 100, 100, -5]],
    };
    const plan = buildPlan(
      [data],
      settings({ includeZeroRows: true, columns: simpleColumns() }),
      emptyExisting,
    );
    expect(plan.errors[0].message).toBe("Los precios y las cantidades no pueden ser negativos");
  });

  it("no trata la primera fila como dato cuando hasHeader es false", () => {
    const plan = buildPlan([sheet], settings({ hasHeader: false }), emptyExisting);
    // La primera fila entra como dato: su columna de costo no es numérica,
    // así que se saltea por la regla de precio 0.
    expect(plan.toCreate).toHaveLength(2);
    expect(plan.toCreate[0].row.name).toBe("Filtro de aceite");
    expect(plan.skipped).toHaveLength(1);
  });

  it("ignora filas completamente vacías", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [["nombre", "costo"], [], ["", ""], ["Algo", 1000]],
    };
    const plan = buildPlan(
      [data],
      settings({ columns: { name: 0, purchasePrice: 1 } }),
      emptyExisting,
    );
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.errors).toHaveLength(1);
  });

  describe("artículos existentes", () => {
    const existing = new Map<string, ExistingArticle>([
      ["FIL-001", { code: "FIL-001", stock: 50, purchasePrice: 2500, salePrice: 4000 }],
    ]);

    it("saltea si el artículo ya existe y la política es skip", () => {
      const plan = buildPlan([sheet], settings({ existing: "skip" }), existing);
      expect(plan.toUpdate).toHaveLength(0);
      expect(plan.skipped[0].reason).toBe("El artículo FIL-001 ya existe");
      expect(plan.toCreate).toHaveLength(1);
    });

    it("suma el stock si la política es sumStock", () => {
      const plan = buildPlan([sheet], settings({ existing: "sumStock" }), existing);
      expect(plan.toUpdate).toEqual([
        { sheet: "Stock", row: 2, name: "Filtro de aceite", code: "FIL-001", data: { stock: 60 } },
      ]);
    });

    it("actualiza los precios si la política es updatePrice", () => {
      const plan = buildPlan([sheet], settings({ existing: "updatePrice", percentage: 100 }), existing);
      expect(plan.toUpdate[0].data).toEqual({ purchasePrice: 2500, salePrice: 5000 });
    });

    it("normaliza el código del Excel a mayúsculas", () => {
      const data: SheetData = {
        name: "Stock",
        rows: [["codigo", "nombre", "", "", 100, 150, 5, ""], ["fil-001", "Filtro", "", "", 100, 150, 5, ""]],
      };
      const plan = buildPlan(
        [data],
        settings({ existing: "sumStock" }),
        new Map([["FIL-001", { code: "FIL-001", stock: 5, purchasePrice: 100, salePrice: 200 }]]),
      );
      expect(plan.toUpdate[0].code).toBe("FIL-001");
    });

    it("crea el artículo si el código del Excel no existe en la base", () => {
      const data: SheetData = {
        name: "Stock",
        rows: [["codigo", "nombre", "", "", 100, 150, 5, ""], ["nuevo-1", "Filtro nuevo", "", "", 100, 150, 5, ""]],
      };
      const plan = buildPlan([data], settings(), existing);
      expect(plan.toCreate).toHaveLength(1);
      expect(plan.toCreate[0].code).toBe("NUEVO-1");
    });
  });

  it("usa los valores por defecto de categoría, modelo y barcode", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [["nombre", "categoria", "modelo", "costo", "venta", "stock", "barcode"], ["Bujía", "", "", 1000, 1500, 4, ""]],
    };
    const plan = buildPlan([data], settings({ columns: simpleColumns() }), emptyExisting);
    const row = plan.toCreate[0].row;
    expect(row.category).toBe("Sin categoría");
    expect(row.motorcycleModel).toBe("Universal");
    expect(row.barcode).toBeNull();
    expect(row.supplier).toBe("Repuestos Norte");
    expect(row.minStock).toBe(5);
  });

  it("el override de modelo de moto gana sobre la columna", () => {
    const plan = buildPlan([sheet], settings({ motorcycleModel: "Honda CB 190R" }), emptyExisting);
    expect(plan.toCreate[0].row.motorcycleModel).toBe("Honda CB 190R");
  });

  it("acumula el plan en varias hojas", () => {
    const second: SheetData = {
      name: "Extra",
      rows: [["nombre", "categoria", "modelo", "costo", "venta", "stock"], ["Cadena", "Transmisión", "FZ 250", 3000, 4500, 4]],
    };
    const plan = buildPlan([sheet, second], settings(), emptyExisting);
    expect(plan.toCreate).toHaveLength(3);
    expect(plan.toCreate[2].row.sheet).toBe("Extra");
  });

  // Un código repetido dentro del archivo solía llegar a article.create() dos
  // veces y reventar con P2002 (HTTP 500). Ahora es un error por fila.
  const dupHeader = ["codigo", "nombre", "categoria", "modelo", "costo", "venta", "stock", "barcode"];

  it("reporta error por fila cuando un código se repite en el archivo", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [
        dupHeader,
        ["ACE-001", "Aceite 20W40", "Lubricantes", "Honda CB 190R", 8500, "", 12, ""],
        ["ACE-001", "Aceite 20W40 reposición", "Lubricantes", "Honda CB 190R", 8500, "", 5, ""],
      ],
    };
    const plan = buildPlan([data], settings(), emptyExisting);
    expect(plan.errors).toEqual([
      { sheet: "Stock", row: 3, message: "El código ACE-001 aparece más de una vez en el archivo" },
    ]);
    // La primera fila sigue en el plan: el error cancela todo, no la deja pasar.
    expect(plan.toCreate).toHaveLength(1);
  });

  it("reporta el duplicado aunque la primera fila se haya salteado por existir", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [
        dupHeader,
        ["ACE-001", "Aceite 20W40", "Lubricantes", "Honda CB 190R", 8500, "", 12, ""],
        ["ACE-001", "Aceite 20W40 reposición", "Lubricantes", "Honda CB 190R", 8500, "", 5, ""],
      ],
    };
    const existing = new Map<string, ExistingArticle>([
      ["ACE-001", { code: "ACE-001", stock: 12, purchasePrice: 8500, salePrice: 13000 }],
    ]);
    const plan = buildPlan([data], settings({ existing: "skip" }), existing);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.errors).toHaveLength(1);
    expect(plan.errors[0].message).toBe("El código ACE-001 aparece más de una vez en el archivo");
    expect(plan.toCreate).toHaveLength(0);
  });

  it("detecta el duplicado ignorando acentos y mayúsculas", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [
        dupHeader,
        ["ACE-1", "Filtro de aceite", "Filtros", "Honda CG 150", 2500, "", 10, ""],
        ["ace-1", "Filtro de aceite copia", "Filtros", "Honda CG 150", 2500, "", 2, ""],
      ],
    };
    const plan = buildPlan([data], settings(), emptyExisting);
    expect(plan.errors).toHaveLength(1);
    expect(plan.errors[0].message).toBe("El código ACE-1 aparece más de una vez en el archivo");
  });

  it("no marca duplicado cuando el código es distinto", () => {
    const extra: SheetData = {
      name: "Extra",
      rows: [
        dupHeader,
        ["ACE-002", "Aceite mineral", "Lubricantes", "Honda CB 190R", 7000, "", 3, ""],
      ],
    };
    const plan = buildPlan([sheet, extra], settings(), emptyExisting);
    expect(plan.errors).toEqual([]);
    expect(plan.toCreate).toHaveLength(3);
  });

  it("encuentra el artículo existente aunque el Excel traiga acentos", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [dupHeader, ["aceó-1", "Bujía NGK", "Encendido", "Kawasaki", 3100, "", 30, ""]],
    };
    // Así se indexa el mapa en el controller: con normalizeUpperCase, no toUpperCase.
    const existing = new Map<string, ExistingArticle>([
      ["ACEO-1", { code: "ACEO-1", stock: 4, purchasePrice: 3000, salePrice: 4500 }],
    ]);
    const plan = buildPlan([data], settings({ existing: "skip" }), existing);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].reason).toBe("El artículo ACEO-1 ya existe");
  });
});

describe("summarize", () => {
  it("cuenta creados, actualizados, salteados y errores", () => {
    const data: SheetData = {
      name: "Stock",
      rows: [
        ["nombre", "categoria", "modelo", "costo", "venta", "stock"],
        ["Nuevo", "", "", 100, 150, 2],
        ["", "", "", 100, 100, 1],
      ],
    };
    const plan = buildPlan([data], settings({ columns: simpleColumns() }), emptyExisting);
    const report = summarize(plan);
    expect(report.created).toBe(1);
    expect(report.updated).toBe(0);
    expect(report.skipped).toBe(0);
    expect(report.errors).toHaveLength(1);
  });
});
