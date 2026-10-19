import { randomInt } from "node:crypto";
import { Role } from "../generated/prisma/client";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** Código de acceso aleatorio, sin caracteres ambiguos (O/0, I/1). */
export function generateAccessCode(length = CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "EMPLOYEE";
}

export function parsePositiveId(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}
