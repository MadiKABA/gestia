-- ProductCategory.updatedAt : backfill des lignes existantes avec un
-- horodatage courant (aucune donnée de modification antérieure disponible,
-- la colonne n'existait pas avant) avant de la rendre NOT NULL.
ALTER TABLE "product_categories" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "product_categories" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "product_categories" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Product.price -> purchasePrice (optionnel) / sellingPrice (obligatoire) :
-- backfill par copie de l'ancienne valeur unique dans sellingPrice avant de
-- supprimer la colonne, aucune donnée existante n'est perdue.
ALTER TABLE "products" ADD COLUMN "purchasePrice" DECIMAL(14,2);
ALTER TABLE "products" ADD COLUMN "sellingPrice" DECIMAL(14,2);
UPDATE "products" SET "sellingPrice" = "price";
ALTER TABLE "products" ALTER COLUMN "sellingPrice" SET NOT NULL;
ALTER TABLE "products" DROP COLUMN "price";
