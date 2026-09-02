-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "code" TEXT;

-- Backfill
UPDATE "User" SET "code" = '$2b$10$zGt6yKwrevhJHCu.eYGY6uxMBH4fTfclE/mfP9UfZINk0w60GNB4y' WHERE "username" = 'admin';
UPDATE "User" SET "code" = '$2b$10$I0aUsmumgNGG1cNRVQ/4feddAySLePz8l5bTSyo9DZslUkSCdSgiu' WHERE "username" = 'empleado';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "code" SET NOT NULL;
