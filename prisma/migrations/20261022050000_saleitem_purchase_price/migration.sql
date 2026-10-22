-- Snapshot del costo de compra en la línea de venta (RF-76).
-- El margen de un reporte histórico tiene que salir del costo que tenía el
-- artículo cuando se vendió, no del precio actual (que puede haber cambiado).
-- Se agrega con default 0 para no romper filas existentes y se backfillea con
-- el costo actual del artículo como mejor aproximación disponible.

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill de los ítems históricos.
UPDATE "SaleItem" si
SET "purchasePrice" = a."purchasePrice"
FROM "Article" a
WHERE a."code" = si."articleCode";
