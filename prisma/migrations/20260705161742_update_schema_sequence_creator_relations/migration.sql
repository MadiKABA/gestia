/*
  Warnings:

  - You are about to drop the column `createdBy` on the `cash_movements` table. All the data in the column will be lost.
  - You are about to drop the column `companyName` on the `parties` table. All the data in the column will be lost.
  - You are about to drop the column `contactName` on the `parties` table. All the data in the column will be lost.
  - You are about to drop the column `isCompany` on the `parties` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `transactions` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `cash_movements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `cash_movements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `parties` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `direction` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `tenant_settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `tenants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "cash_movements" DROP COLUMN "createdBy",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "parties" DROP COLUMN "companyName",
DROP COLUMN "contactName",
DROP COLUMN "isCompany",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "createdBy",
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "direction" "PaymentDirection" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "createdBy",
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "sequences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "creditCounter" INTEGER NOT NULL DEFAULT 0,
    "debtCounter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sequences_tenantId_idx" ON "sequences"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sequences_tenantId_year_key" ON "sequences"("tenantId", "year");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_movements_tenantId_createdAt_idx" ON "cash_movements"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_tenantId_createdAt_idx" ON "payments"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_tenantId_createdAt_idx" ON "transactions"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
