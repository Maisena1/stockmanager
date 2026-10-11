import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { buildResumen, type TurnoResumen } from "../lib/turnos";

const userSelect = { select: { id: true, username: true, role: true } };

async function resumenFor(userId: number, from: Date, to: Date): Promise<TurnoResumen> {
  const [ventas, acciones] = await Promise.all([
    prisma.sale.findMany({ where: { userId, createdAt: { gte: from, lte: to } } }),
    prisma.auditLog.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "asc" },
      select: { id: true, action: true, detail: true, createdAt: true },
    }),
  ]);
  return buildResumen(ventas, acciones);
}

function parseTurnoId(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

export async function closeTurno(req: Request, res: Response) {
  const role = req.user!.role;
  const userId = req.user!.userId;
  const rawTurnId = req.body?.turnId;

  let targetId: number | null = null;
  if (rawTurnId !== undefined && rawTurnId !== null && rawTurnId !== "") {
    targetId = parseTurnoId(rawTurnId);
    if (targetId === null) {
      return res.status(400).json({ error: "El identificador de turno debe ser un número entero positivo" });
    }
  }

  let turno;
  if (targetId !== null) {
    turno = await prisma.turno.findUnique({ where: { id: targetId }, include: { user: userSelect } });
    if (!turno) {
      return res.status(404).json({ error: "Turno no encontrado" });
    }
    if (role !== "ADMIN" && turno.userId !== userId) {
      return res.status(403).json({ error: "Sólo podés cerrar tu propio turno" });
    }
  } else {
    turno = await prisma.turno.findFirst({
      where: { userId, cerradoAt: null },
      orderBy: { abiertoAt: "desc" },
      include: { user: userSelect },
    });
    if (!turno) {
      return res.status(404).json({ error: "No tenés un turno abierto" });
    }
  }

  if (turno.cerradoAt) {
    return res.status(400).json({ error: "El turno ya está cerrado" });
  }

  // Cierro primero y calculo el resumen con la ventana ya guardada: así el
  // resumen coincide exactamente con lo que quedó registrado en el turno.
  const cerrado = await prisma.turno.update({
    where: { id: turno.id },
    data: { cerradoAt: new Date() },
    include: { user: userSelect },
  });

  const resumen = await resumenFor(cerrado.userId, cerrado.abiertoAt, cerrado.cerradoAt!);

  return res.json({ turno: cerrado, resumen });
}

export async function listTurnos(req: Request, res: Response) {
  const role = req.user!.role;
  const userId = req.user!.userId;

  const turnos = await prisma.turno.findMany({
    where: role === "ADMIN" ? {} : { userId },
    orderBy: { abiertoAt: "desc" },
    include: { user: userSelect },
  });

  return res.json(turnos);
}

export async function getTurno(req: Request, res: Response) {
  const role = req.user!.role;
  const userId = req.user!.userId;
  const id = parseTurnoId(req.params.id);

  if (id === null) {
    return res.status(400).json({ error: "El identificador de turno debe ser un número entero positivo" });
  }

  const turno = await prisma.turno.findUnique({ where: { id }, include: { user: userSelect } });
  if (!turno) {
    return res.status(404).json({ error: "Turno no encontrado" });
  }
  if (role !== "ADMIN" && turno.userId !== userId) {
    return res.status(403).json({ error: "No podés ver turnos de otro usuario" });
  }

  const resumen = await resumenFor(turno.userId, turno.abiertoAt, turno.cerradoAt ?? new Date());

  return res.json({ turno, resumen });
}
