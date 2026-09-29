import { prisma } from "../lib/prisma";
import { normalizeUpperCase } from "./normalizar";

type ArticleClient = Pick<typeof prisma, "article">;

export function prefixFrom(name: string): string {
  return normalizeUpperCase(name).replace(/[^A-Z]/g, "").slice(0, 3) || "ART";
}

function nextSequential(codes: string[], prefix: string): number {
  let max = 0;
  for (const code of codes) {
    const num = parseInt(code.slice(prefix.length + 1), 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  return max + 1;
}

export async function generateCode(name: string): Promise<string> {
  const prefix = prefixFrom(name);
  const existing = await prisma.article.findMany({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
  });
  return `${prefix}-${String(nextSequential(existing.map((e) => e.code), prefix)).padStart(3, "0")}`;
}

/**
 * Genera un lote de códigos con una sola consulta. Los duplicados dentro del
 * propio lote también se desambiguán incrementando el secuencial.
 */
export async function generateCodes(
  names: string[],
  client: ArticleClient = prisma,
): Promise<string[]> {
  const prefixes = [...new Set(names.map(prefixFrom))];
  if (prefixes.length === 0) return [];

  const existing = await client.article.findMany({
    where: { OR: prefixes.map((prefix) => ({ code: { startsWith: `${prefix}-` } })) },
    select: { code: true },
  });

  const byPrefix = new Map<string, string[]>(prefixes.map((p) => [p, []]));
  for (const article of existing) {
    const prefix = prefixes.find((p) => article.code.startsWith(`${p}-`));
    if (prefix) byPrefix.get(prefix)!.push(article.code);
  }

  const counters = new Map<string, number>(
    prefixes.map((p) => [p, nextSequential(byPrefix.get(p)!, p)]),
  );

  return names.map((name) => {
    const prefix = prefixFrom(name);
    const seq = counters.get(prefix)!;
    counters.set(prefix, seq + 1);
    return `${prefix}-${String(seq).padStart(3, "0")}`;
  });
}
