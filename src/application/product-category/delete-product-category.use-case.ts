import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/shared/errors";
import type { ProductCategoryRepository } from "@/application/product-category/product-category.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Soft delete réservé au patron (même garde que deleteProduct/deleteParty).
 *
 * `hasActiveProducts` est un contrat fonctionnel local (pas un import de
 * `application/product`, même raison que `deleteParty`/`hasOpenTransactions`) :
 * `application/product-category` ne dépend jamais de `application/product`,
 * seul le composition root
 * (`infrastructure/product-category/product-category-mutation-handler.ts`)
 * connaît les deux côtés et injecte l'implémentation réelle
 * (`ProductRepository.hasActiveProductsInCategory`).
 */
export async function deleteProductCategory(
  context: TenantContext,
  deps: {
    repository: ProductCategoryRepository;
    auditLogger: AuditLogger;
    hasActiveProducts: (categoryId: string) => Promise<boolean>;
  },
  id: string,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }

  const existing = await deps.repository.findById(id);
  if (!existing) {
    throw new NotFoundError("ProductCategory", id);
  }

  if (await deps.hasActiveProducts(id)) {
    throw new ValidationError(
      "Cette catégorie contient encore des produits, retire-les d'abord ou change leur catégorie",
    );
  }

  const deleted = await deps.repository.delete(id);

  await deps.auditLogger.log(context, {
    action: "product_category.deleted",
    entity: "ProductCategory",
    entityId: deleted.id,
    oldData: existing,
  });

  return deleted;
}
