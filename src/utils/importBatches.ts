export interface DuplicateImport {
  batchId: number;
  userId: number;
  fileName: string;
  fileSize: number;
  createdAt: Date;
  count: number;
  cooldownMin: number;
}

export function formatFileSize(bytes: number): string {
  const value = Math.max(0, bytes);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value)} B`;
}

export function formatTimeAgo(from: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "hace menos de 1 min";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

function duplicateDetails(
  duplicate: DuplicateImport,
  now: Date,
): { name: string; size: string; ago: string; times: string } {
  return {
    name: JSON.stringify(duplicate.fileName),
    size: formatFileSize(duplicate.fileSize),
    ago: formatTimeAgo(duplicate.createdAt, now),
    times: duplicate.count === 1 ? "1 vez" : `${duplicate.count} veces`,
  };
}

/**
 * Aviso accionable para el 409 y para el preview. Habla en presente porque
 * todavía no se importó: el usuario tiene que confirmar.
 */
export function buildDuplicateMessage(
  duplicate: DuplicateImport,
  currentUserId: number,
  now: Date = new Date(),
): string {
  const who = duplicate.userId === currentUserId ? "Ya importaste" : "Ya se importó";
  const { name, size, ago, times } = duplicateDetails(duplicate, now);
  return `${who} ${name} (${size}) ${ago} en la importación #${duplicate.batchId} (${times} en los últimos ${duplicate.cooldownMin} min). Estás por duplicar la carga. Si es intencional, confirmá la duplicación.`;
}

/**
 * Variante en pasado para el reporte final: la importación duplicada ya se
 * hizo con confirmación explícita.
 */
export function buildDuplicateWarning(
  duplicate: DuplicateImport,
  now: Date = new Date(),
): string {
  const { name, size, ago, times } = duplicateDetails(duplicate, now);
  return `Se importó igualmente ${name} (${size}), ya importado ${ago} en la importación #${duplicate.batchId} (${times} en los últimos ${duplicate.cooldownMin} min).`;
}
