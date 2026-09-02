/*
  Warnings:

  - Added the required column `paymentMethod` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL;
