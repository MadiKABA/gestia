-- Remplace le champ libre `TenantSettings.currency` (String) par une liste
-- fermée de devises supportées (voir src/config/currencies.ts). Cast direct
-- de la colonne existante plutôt qu'un drop+recreate généré automatiquement
-- par `prisma migrate dev` : la seule valeur en base à ce jour est "FCFA",
-- qui correspond exactement à une valeur de l'enum, donc aucune perte de
-- données.

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('FCFA', 'GNF');

-- AlterTable
ALTER TABLE "tenant_settings" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "tenant_settings" ALTER COLUMN "currency" TYPE "Currency" USING ("currency"::"Currency");
ALTER TABLE "tenant_settings" ALTER COLUMN "currency" SET DEFAULT 'FCFA';
