-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PROVEEDOR_CREADO';
ALTER TYPE "AuditAction" ADD VALUE 'PROVEEDOR_ACTUALIZADO';
ALTER TYPE "AuditAction" ADD VALUE 'PROVEEDOR_ELIMINADO';

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "supplierId" INTEGER;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- Migración de datos: un proveedor por nombre normalizado (sin distinguir
-- mayúsculas ni espacios sobrantes) y vinculación de los artículos existentes.
INSERT INTO "Supplier" ("name")
SELECT DISTINCT ON (LOWER(TRIM("supplier"))) TRIM("supplier")
FROM "Article"
WHERE TRIM("supplier") <> ''
ORDER BY LOWER(TRIM("supplier")), TRIM("supplier");

UPDATE "Article" a
SET "supplierId" = s."id"
FROM "Supplier" s
WHERE LOWER(TRIM(a."supplier")) = LOWER(s."name");

-- El índice único de barcode no puede crearse si ya hay duplicados. Se
-- conserva el del artículo con menor código y se liberan los demás.
UPDATE "Article"
SET "barcode" = TRIM("barcode")
WHERE "barcode" IS NOT NULL;

UPDATE "Article"
SET "barcode" = NULL
WHERE "barcode" IS NOT NULL AND "barcode" = '';

UPDATE "Article" a
SET "barcode" = NULL
WHERE a."barcode" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Article" b
    WHERE b."barcode" = a."barcode"
      AND b."code" < a."code"
  );

-- CreateIndex
CREATE UNIQUE INDEX "Article_barcode_key" ON "Article"("barcode");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
