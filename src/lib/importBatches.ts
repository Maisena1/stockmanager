import { prisma } from "./prisma";
import type { DuplicateImport } from "../utils/importBatches";

export const DEFAULT_IMPORT_DUP_COOLDOWN_MIN = 30;

export function getImportDupCooldownMin(): number {
  const raw = process.env.IMPORT_DUP_COOLDOWN_MIN;
  if (raw === undefined || raw.trim() === "") return DEFAULT_IMPORT_DUP_COOLDOWN_MIN;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_IMPORT_DUP_COOLDOWN_MIN;
  return parsed;
}

/**
 * Busca el último lote con el mismo nombre y peso dentro del cooldown.
 * El control es global (no por usuario): el stock es compartido.
 */
export async function findRecentDuplicate(
  fileName: string,
  fileSize: number,
  now: Date = new Date(),
): Promise<DuplicateImport | null> {
  const cooldownMin = getImportDupCooldownMin();
  const since = new Date(now.getTime() - cooldownMin * 60_000);

  const matches = await prisma.importBatch.findMany({
    where: { fileName, fileSize, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      fileName: true,
      fileSize: true,
      createdAt: true,
    },
  });

  const latest = matches[0];
  if (!latest) return null;

  return {
    batchId: latest.id,
    userId: latest.userId,
    fileName: latest.fileName,
    fileSize: latest.fileSize,
    createdAt: latest.createdAt,
    count: matches.length,
    cooldownMin,
  };
}
