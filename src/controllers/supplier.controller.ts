import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { logAudit } from "../lib/audit";
import {
  isValidEmail,
  normalizeSupplierName,
  parseOptionalText,
  parsePositiveId,
} from "../utils/proveedores";

const supplierSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  notes: true,
  createdAt: true,
} as const;

async function countImpact(supplierId: number) {
  const [articles, sales, saleItems] = await Promise.all([
    prisma.article.count({ where: { supplierId } }),
    prisma.sale.count({ where: { items: { some: { article: { supplierId } } } } }),
    prisma.saleItem.count({ where: { article: { supplierId } } }),
  ]);

  return { articles, sales, saleItems };
}

export async function listOptions(_req: Request, res: Response) {
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return res.json(suppliers);
}

export async function list(_req: Request, res: Response) {
  const suppliers = await prisma.supplier.findMany({
    select: {
      ...supplierSelect,
      _count: { select: { articles: true } },
    },
    orderBy: { name: "asc" },
  });

  return res.json(
    suppliers.map(({ _count, ...supplier }) => ({
      ...supplier,
      articleCount: _count.articles,
    })),
  );
}

export async function create(req: Request, res: Response) {
  const body = req.body ?? {};
  const name = normalizeSupplierName(body.name);
  const phone = parseOptionalText(body.phone, "teléfono");
  const email = parseOptionalText(body.email, "email");
  const notes = parseOptionalText(body.notes, "notas");

  if (!name) {
    return res.status(400).json({ error: "El nombre del proveedor es obligatorio" });
  }
  if (!phone.ok) return res.status(400).json({ error: phone.error });
  if (!email.ok) return res.status(400).json({ error: email.error });
  if (!notes.ok) return res.status(400).json({ error: notes.error });
  if (email.value && !isValidEmail(email.value)) {
    return res.status(400).json({ error: "El email del proveedor no tiene un formato válido" });
  }

  const existing = await prisma.supplier.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return res.status(400).json({ error: "Ya existe un proveedor con ese nombre" });
  }

  try {
    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          name,
          phone: phone.value,
          email: email.value,
          notes: notes.value,
        },
        select: supplierSelect,
      });

      await logAudit(tx, {
        userId: req.user!.userId,
        action: "PROVEEDOR_CREADO",
        detail: `Proveedor "${created.name}" creado`,
      });

      return created;
    });

    return res.status(201).json(supplier);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(400).json({ error: "Ya existe un proveedor con ese nombre" });
    }
    throw err;
  }
}

export async function update(req: Request, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "El identificador de proveedor debe ser un número entero positivo" });
  }

  const target = await prisma.supplier.findUnique({ where: { id } });
  if (!target) {
    return res.status(404).json({ error: "Proveedor no encontrado" });
  }

  const body = req.body ?? {};
  const data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
  } = {};

  if (body.name !== undefined) {
    const name = normalizeSupplierName(body.name);
    if (!name) {
      return res.status(400).json({ error: "El nombre del proveedor es obligatorio" });
    }
    if (name !== target.name) {
      const duplicated = await prisma.supplier.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
      });
      if (duplicated) {
        return res.status(400).json({ error: "Ya existe un proveedor con ese nombre" });
      }
    }
    data.name = name;
  }

  if (body.phone !== undefined) {
    const phone = parseOptionalText(body.phone, "teléfono");
    if (!phone.ok) return res.status(400).json({ error: phone.error });
    data.phone = phone.value;
  }

  if (body.email !== undefined) {
    const email = parseOptionalText(body.email, "email");
    if (!email.ok) return res.status(400).json({ error: email.error });
    if (email.value && !isValidEmail(email.value)) {
      return res.status(400).json({ error: "El email del proveedor no tiene un formato válido" });
    }
    data.email = email.value;
  }

  if (body.notes !== undefined) {
    const notes = parseOptionalText(body.notes, "notas");
    if (!notes.ok) return res.status(400).json({ error: notes.error });
    data.notes = notes.value;
  }

  const fields = Object.keys(data);
  if (fields.length === 0) {
    return res.status(400).json({ error: "No hay cambios para guardar" });
  }

  try {
    const supplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data,
        select: supplierSelect,
      });

      if (data.name && data.name !== target.name) {
        // La columna legacy sigue en uso por otros endpoints hasta el issue de filtros.
        await tx.article.updateMany({
          where: { supplierId: id },
          data: { supplier: data.name },
        });
      }

      await logAudit(tx, {
        userId: req.user!.userId,
        action: "PROVEEDOR_ACTUALIZADO",
        detail: `Proveedor "${updated.name}" actualizado (campos: ${fields.join(", ")})`,
      });

      return updated;
    });

    return res.json(supplier);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(400).json({ error: "Ya existe un proveedor con ese nombre" });
    }
    throw err;
  }
}

export async function impact(req: Request, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "El identificador de proveedor debe ser un número entero positivo" });
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!supplier) {
    return res.status(404).json({ error: "Proveedor no encontrado" });
  }

  const counts = await countImpact(id);
  return res.json({ ...supplier, ...counts, canDelete: true });
}

export async function remove(req: Request, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "El identificador de proveedor debe ser un número entero positivo" });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) {
    return res.status(404).json({ error: "Proveedor no encontrado" });
  }

  // Política elegida: se eliminan el proveedor y sus artículos, pero el
  // historial de ventas se conserva (SaleItem.articleCode queda en NULL por la
  // FK onDelete: SetNull y la línea guarda su articleName). La auditoría
  // tampoco se toca. La UI muestra el impacto y advierte antes de confirmar.
  await prisma.$transaction(async (tx) => {
    const articles = await tx.article.count({ where: { supplierId: id } });
    const sales = await tx.sale.count({
      where: { items: { some: { article: { supplierId: id } } } },
    });
    const saleItems = await tx.saleItem.count({ where: { article: { supplierId: id } } });

    await tx.supplier.delete({ where: { id } });

    await logAudit(tx, {
      userId: req.user!.userId,
      action: "PROVEEDOR_ELIMINADO",
      detail: `Proveedor "${supplier.name}" eliminado junto con ${articles} artículo(s); historial de ventas conservado: ${sales} venta(s), ${saleItems} ítem(s)`,
    });
  });

  return res.status(204).send();
}
