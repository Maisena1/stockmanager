-- AlterTable
-- Agrega Article.updatedAt (se actualiza desde Prisma con @updatedAt) y elimina
-- el campo de texto legacy "supplier", que quedó reemplazado por la relación
-- supplierId -> Supplier (RF-73 / RF-74).
ALTER TABLE "Article" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Defensivo: si algún artículo todavía no tiene supplierId pero conserva el
-- texto, se crea/vincula el proveedor antes de borrar la columna. En la base
-- actual todos los artículos ya tienen supplierId (0 filas afectadas).
INSERT INTO "Supplier" ("name")
SELECT DISTINCT ON (LOWER(TRIM(a."supplier"))) TRIM(a."supplier")
FROM "Article" a
WHERE a."supplierId" IS NULL
  AND TRIM(a."supplier") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "Supplier" s WHERE LOWER(s."name") = LOWER(TRIM(a."supplier"))
  )
ORDER BY LOWER(TRIM(a."supplier")), TRIM(a."supplier");

UPDATE "Article" a
SET "supplierId" = s."id"
FROM "Supplier" s
WHERE a."supplierId" IS NULL
  AND LOWER(TRIM(a."supplier")) = LOWER(s."name");

ALTER TABLE "Article" DROP COLUMN "supplier";
