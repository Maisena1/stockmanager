-- Snapshot histórico de la línea de venta. A partir de acá SaleItem guarda el
-- nombre del artículo al momento de la venta, de modo que borrar un artículo
-- (o un proveedor, que borra sus artículos) NO destruya el historial de ventas.

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "articleName" TEXT;

-- Backfill: los ítems existentes toman el nombre actual de su artículo.
UPDATE "SaleItem" si
SET "articleName" = a."name"
FROM "Article" a
WHERE a."code" = si."articleCode";

-- Salvaguarda por si hubiera huérfanos (no debería: la FK era CASCADE).
UPDATE "SaleItem"
SET "articleName" = 'Artículo eliminado'
WHERE "articleName" IS NULL;

ALTER TABLE "SaleItem" ALTER COLUMN "articleName" SET NOT NULL;

-- articleCode pasa a ser opcional para que la FK pueda usar SET NULL.
ALTER TABLE "SaleItem" ALTER COLUMN "articleCode" DROP NOT NULL;

-- Se reemplaza la cascada por SET NULL: la fila de venta sobrevive.
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_articleCode_fkey";
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_articleCode_fkey"
  FOREIGN KEY ("articleCode") REFERENCES "Article"("code") ON DELETE SET NULL ON UPDATE CASCADE;
