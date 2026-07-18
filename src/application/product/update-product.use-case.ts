import type { TenantContext } from "@/domain/shared/tenant-context";
import { validateProductInput } from "@/domain/product/product.entity";
import { DependencyNotFoundError, ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type {
  ProductRepository,
  ResolvedProductInput,
} from "@/application/product/product.repository";
import type { ProductCategoryRepository } from "@/application/product-category/product-category.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

export async function updateProduct(
  context: TenantContext,
  deps: {
    repository: ProductRepository;
    categoryRepository: ProductCategoryRepository;
    auditLogger: AuditLogger;
  },
  id: string,
  input: ResolvedProductInput,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }
  validateProductInput(input);

  const existing = await deps.repository.findById(id);
  if (!existing) {
    throw new NotFoundError("Product", id);
  }

  if (input.categoryId) {
    const category = await deps.categoryRepository.findById(input.categoryId);
    if (!category) {
      // Même raisonnement qu'à la création : `categoryId` peut référencer
      // une ProductCategory créée hors ligne dans la même session.
      throw new DependencyNotFoundError("ProductCategory", input.categoryId);
    }
  }

  const updated = await deps.repository.update(id, input);

  await deps.auditLogger.log(context, {
    action: "product.updated",
    entity: "Product",
    entityId: updated.id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}
