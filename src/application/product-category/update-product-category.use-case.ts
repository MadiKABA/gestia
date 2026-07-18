import type { TenantContext } from "@/domain/shared/tenant-context";
import { validateProductCategoryInput } from "@/domain/product-category/product-category.entity";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type {
  ProductCategoryInput,
  ProductCategory,
} from "@/domain/product-category/product-category.entity";
import type { ProductCategoryRepository } from "@/application/product-category/product-category.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/** Même garde que createProductCategory : seul le patron gère le catalogue. */
export async function updateProductCategory(
  context: TenantContext,
  deps: { repository: ProductCategoryRepository; auditLogger: AuditLogger },
  id: string,
  input: ProductCategoryInput,
): Promise<ProductCategory> {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }
  validateProductCategoryInput(input);

  const existing = await deps.repository.findById(id);
  if (!existing) {
    throw new NotFoundError("ProductCategory", id);
  }

  const updated = await deps.repository.update(id, input);

  await deps.auditLogger.log(context, {
    action: "product_category.updated",
    entity: "ProductCategory",
    entityId: updated.id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}
