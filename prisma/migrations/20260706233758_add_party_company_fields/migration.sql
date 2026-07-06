-- AlterTable
ALTER TABLE "parties" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "isCompany" BOOLEAN NOT NULL DEFAULT false;
