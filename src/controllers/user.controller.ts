import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma, Role } from "../generated/prisma/client";
import { hashPassword } from "../utils/hashing";
import { logAudit } from "../lib/audit";
import { invalidateUserSession } from "../lib/sessions";
import { generateAccessCode, isRole, parsePositiveId } from "../utils/usuarios";

const userSelect = {
  id: true,
  username: true,
  role: true,
  active: true,
  phone: true,
  notes: true,
  createdAt: true,
} as const;

type OptionalText =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

function parseOptionalText(value: unknown, field: string): OptionalText {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `El campo ${field} debe ser texto` };
  }
  return { ok: true, value: value.trim() || null };
}

function parseUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim();
  return username === "" ? null : username;
}

export async function list(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { id: "asc" },
  });
  return res.json(users);
}

export async function create(req: Request, res: Response) {
  const body = req.body ?? {};
  const username = parseUsername(body.username);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const role: Role = body.role === undefined ? "EMPLOYEE" : body.role;
  const phone = parseOptionalText(body.phone, "teléfono");
  const notes = parseOptionalText(body.notes, "notas");

  if (!username) {
    return res.status(400).json({ error: "El nombre de usuario es obligatorio" });
  }
  if (!code) {
    return res.status(400).json({ error: "El código de acceso es obligatorio" });
  }
  if (!isRole(role)) {
    return res.status(400).json({ error: "Rol inválido. Valores permitidos: ADMIN, EMPLOYEE" });
  }
  if (!phone.ok) return res.status(400).json({ error: phone.error });
  if (!notes.ok) return res.status(400).json({ error: notes.error });

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return res.status(400).json({ error: "Ya existe un usuario con ese nombre" });
  }

  const codeHash = await hashPassword(code);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          code: codeHash,
          role,
          phone: phone.value,
          notes: notes.value,
        },
        select: userSelect,
      });

      await logAudit(tx, {
        userId: req.user!.userId,
        action: "USUARIO_CREADO",
        detail: `Usuario "${created.username}" creado (rol ${created.role})`,
      });

      return created;
    });

    return res.status(201).json(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(400).json({ error: "Ya existe un usuario con ese nombre" });
    }
    throw err;
  }
}

export async function update(req: Request, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "El identificador de usuario debe ser un número entero positivo" });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const body = req.body ?? {};
  const data: {
    username?: string;
    phone?: string | null;
    notes?: string | null;
    role?: Role;
    active?: boolean;
  } = {};

  if (body.username !== undefined) {
    const username = parseUsername(body.username);
    if (!username) {
      return res.status(400).json({ error: "El nombre de usuario es obligatorio" });
    }
    data.username = username;
  }

  if (body.phone !== undefined) {
    const phone = parseOptionalText(body.phone, "teléfono");
    if (!phone.ok) return res.status(400).json({ error: phone.error });
    data.phone = phone.value;
  }

  if (body.notes !== undefined) {
    const notes = parseOptionalText(body.notes, "notas");
    if (!notes.ok) return res.status(400).json({ error: notes.error });
    data.notes = notes.value;
  }

  if (body.role !== undefined) {
    if (!isRole(body.role)) {
      return res.status(400).json({ error: "Rol inválido. Valores permitidos: ADMIN, EMPLOYEE" });
    }
    data.role = body.role;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return res.status(400).json({ error: "El campo activo debe ser verdadero o falso" });
    }
    data.active = body.active;
  }

  if (data.active === false && id === req.user!.userId) {
    return res.status(400).json({ error: "No podés desactivar tu propio usuario" });
  }

  const fields = Object.keys(data);
  if (fields.length === 0) {
    return res.status(400).json({ error: "No hay cambios para guardar" });
  }

  if (data.username && data.username !== target.username) {
    const duplicated = await prisma.user.findUnique({ where: { username: data.username } });
    if (duplicated) {
      return res.status(400).json({ error: "Ya existe un usuario con ese nombre" });
    }
  }

  const deactivated = target.active && data.active === false;
  const lostAdminRole = target.role === "ADMIN" && data.role !== undefined && data.role !== "ADMIN";

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data,
        select: userSelect,
      });

      await logAudit(tx, {
        userId: req.user!.userId,
        action: deactivated ? "USUARIO_DESHABILITADO" : "USUARIO_ACTUALIZADO",
        detail: deactivated
          ? `Usuario "${updated.username}" deshabilitado`
          : `Usuario "${updated.username}" actualizado (campos: ${fields.join(", ")})`,
      });

      return updated;
    });

    if (deactivated || lostAdminRole) {
      invalidateUserSession(id);
    }

    return res.json(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(400).json({ error: "Ya existe un usuario con ese nombre" });
    }
    throw err;
  }
}

export async function resetCode(req: Request, res: Response) {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "El identificador de usuario debe ser un número entero positivo" });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const code = generateAccessCode();
  const codeHash = await hashPassword(code);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { code: codeHash } });

    await logAudit(tx, {
      userId: req.user!.userId,
      action: "CODIGO_RESETEADO",
      detail: `Código de acceso de "${target.username}" reseteado`,
    });
  });

  // El código en claro se devuelve una única vez; nunca se guarda ni se audita.
  return res.json({ code });
}
