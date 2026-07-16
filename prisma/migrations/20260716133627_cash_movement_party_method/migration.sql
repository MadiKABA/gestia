-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "method" "PaymentMethod",
ADD COLUMN     "partyId" TEXT;

-- CreateIndex
CREATE INDEX "cash_movements_tenantId_partyId_idx" ON "cash_movements"("tenantId", "partyId");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
