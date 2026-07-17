import type { TenantContext } from "@/domain/shared/tenant-context";
import { validateProductCategoryInput } from "@/domain/product-category/product-category.entity";
import { ForbiddenError } from "@/domain/shared/errors";
import type {
  ProductCategoryInput,
  ProductCategory,
} from "@/domain/product-category/product-category.entity";
import type { ProductCategoryRepository } from "@/application/product-category/product-category.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/** Même garde que createProduct : seul le patron gère le catalogue, y
 * compris ses catégories (le vendeur ne fait que sélectionner un produit
 * existant, cf. CLAUDE.md Rôles). */
export async function createProductCategory(
  context: TenantContext,
  deps: { repository: ProductCategoryRepository; auditLogger: AuditLogger },
  id: string,
  input: ProductCategoryInput,
): Promise<ProductCategory> {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }
  validateProductCategoryInput(input);

  const category = await deps.repository.create(id, input);

  await deps.auditLogger.log(context, {
    action: "product_category.created",
    entity: "ProductCategory",
    entityId: category.id,
    newData: category,
  });

  return category;
}
