-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'USUARIO_CREADO';
ALTER TYPE "AuditAction" ADD VALUE 'USUARIO_ACTUALIZADO';
ALTER TYPE "AuditAction" ADD VALUE 'USUARIO_DESHABILITADO';
ALTER TYPE "AuditAction" ADD VALUE 'CODIGO_RESETEADO';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT;
