import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = "test-secret";
  process.env.JWT_EXPIRES_IN = "1h";
});

const prismaMock = vi.hoisted(() => {
  const mock = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
  mock.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(mock));
  return mock;
});

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn() }));

import {
  create,
  list,
  resetCode,
  update,
} from "../src/controllers/user.controller";
import { login } from "../src/controllers/auth.controller";
import { authenticate } from "../src/middlewares/auth";
import { requireRole } from "../src/middlewares/roles";
import { logAudit } from "../src/lib/audit";
import { comparePassword } from "../src/utils/hashing";
import { signToken } from "../src/utils/jwt";
import {
  clearAdminSession,
  ensureAdminSession,
  getAdminSession,
} from "../src/lib/sessions";

function fakeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = vi.fn(() => res);
  return res;
}

function fakeReq(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { userId: 1, role: "ADMIN" },
    ...overrides,
  } as any;
}

const targetUser = {
  id: 5,
  username: "empleado",
  role: "EMPLOYEE",
  active: true,
  phone: null,
  notes: null,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  clearAdminSession();
  prismaMock.user.findMany.mockReset();
  prismaMock.user.findUnique.mockReset();
  prismaMock.user.create.mockReset();
  prismaMock.user.update.mockReset();
  prismaMock.$transaction.mockReset();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(prismaMock));
});

describe("GET /api/users", () => {
  it("lista usuarios con estado y sin código", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 1, username: "admin", role: "ADMIN", active: true, phone: null, notes: null, createdAt: new Date() },
    ]);

    const res = fakeRes();
    await list(fakeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).not.toHaveProperty("code");
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      select: expect.objectContaining({ active: true, createdAt: true }),
      orderBy: { id: "asc" },
    });
  });
});

describe("POST /api/users", () => {
  it("crea el usuario con el código hasheado y registra auditoría", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockImplementation(async ({ data }: any) => ({
      id: 3,
      username: data.username,
      role: data.role,
      active: true,
      phone: data.phone,
      notes: data.notes,
      createdAt: new Date(),
    }));

    const res = fakeRes();
    await create(
      fakeReq({ body: { username: "nuevo", code: "clave123", role: "EMPLOYEE" } }),
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).not.toHaveProperty("code");
    const createData = prismaMock.user.create.mock.calls[0][0].data;
    expect(createData.code).not.toBe("clave123");
    expect(await comparePassword("clave123", createData.code)).toBe(true);
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "USUARIO_CREADO" }),
    );
  });

  it("rechaza un username duplicado", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 1, username: "nuevo" });

    const res = fakeRes();
    await create(fakeReq({ body: { username: "nuevo", code: "clave123" } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Ya existe");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/users/:id/reset-code", () => {
  it("genera un código nuevo, lo devuelve una vez y guarda sólo el hash", async () => {
    prismaMock.user.findUnique.mockResolvedValue(targetUser);
    prismaMock.user.update.mockResolvedValue(targetUser);

    const res = fakeRes();
    await resetCode(fakeReq({ params: { id: "5" } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(updateData.code).not.toBe(res.body.code);
    expect(await comparePassword(res.body.code, updateData.code)).toBe(true);

    const audit = (logAudit as any).mock.calls[0][1];
    expect(audit.action).toBe("CODIGO_RESETEADO");
    expect(audit.detail).not.toContain(res.body.code);
  });

  it("responde 404 si el usuario no existe", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = fakeRes();
    await resetCode(fakeReq({ params: { id: "99" } }), res);

    expect(res.statusCode).toBe(404);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/users/:id", () => {
  it("da de baja lógica sin borrar la fila e invalida la sesión del usuario", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...targetUser, role: "ADMIN" });
    prismaMock.user.update.mockResolvedValue({ ...targetUser, role: "ADMIN", active: false });
    ensureAdminSession(targetUser.id);

    const res = fakeRes();
    await update(
      fakeReq({ params: { id: "5" }, body: { active: false }, user: { userId: 1, role: "ADMIN" } }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 }, data: { active: false } }),
    );
    expect(getAdminSession()).toBeNull();
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "USUARIO_DESHABILITADO" }),
    );
  });

  it("no permite que un admin se desactive a sí mismo", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...targetUser, id: 1, role: "ADMIN" });

    const res = fakeRes();
    await update(
      fakeReq({ params: { id: "1" }, body: { active: false }, user: { userId: 1, role: "ADMIN" } }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("desactivar tu propio");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("autenticación", () => {
  it("un empleado recibe 403 en una ruta sólo para admin", () => {
    const res = fakeRes();
    const next = vi.fn();

    requireRole("ADMIN")(fakeReq({ user: { userId: 2, role: "EMPLOYEE" } }), res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("un usuario desactivado no pasa authenticate", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ active: false, role: "EMPLOYEE" });
    const token = signToken({ userId: 9, role: "EMPLOYEE" });
    const res = fakeRes();
    const next = vi.fn();

    await authenticate(
      fakeReq({ headers: { authorization: `Bearer ${token}` } }),
      res,
      next,
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("login ignora a los usuarios inactivos", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const res = fakeRes();
    await login(fakeReq({ body: { codigo: "clave123" } }), res);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({ where: { active: true } });
    expect(res.statusCode).toBe(401);
  });
});
