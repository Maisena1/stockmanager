import { prisma } from "../lib/prisma";
import { normalizeUpperCase } from "./normalizar";

function prefixFrom(name: string): string {
  return normalizeUpperCase(name).replace(/[^A-Z]/g, "").slice(0, 3) || "ART";
}

export async function generateCode(name: string): Promise<string> {
  const prefix = prefixFrom(name);

  const existing = await prisma.article.findMany({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
  });

  let max = 0;
  for (const e of existing) {
    const num = parseInt(e.code.slice(prefix.length + 1), 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }

  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
