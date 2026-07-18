import type { TenantContext } from "@/domain/shared/tenant-context";
import { validateProductInput } from "@/domain/product/product.entity";
import { DependencyNotFoundError, ForbiddenError } from "@/domain/shared/errors";
import type {
  ProductRepository,
  ResolvedProductInput,
} from "@/application/product/product.repository";
import type { ProductCategoryRepository } from "@/application/product-category/product-category.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/** Création réservée au patron (le vendeur ne peut que consulter/sélectionner
 * un produit, cf. CLAUDE.md Rôles). */
export async function createProduct(
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

  if (input.categoryId) {
    const category = await deps.categoryRepository.findById(input.categoryId);
    if (!category) {
      // Distinct d'un NotFoundError ordinaire : `categoryId` peut référencer
      // une ProductCategory créée hors ligne dans la même session, pas
      // encore synchronisée — même raisonnement que createTransaction pour
      // `partyId` (voir DependencyNotFoundError et
      // infrastructure/offline/sync-engine.ts).
      throw new DependencyNotFoundError("ProductCategory", input.categoryId);
    }
  }

  const product = await deps.repository.create(id, input, context.userId);

  await deps.auditLogger.log(context, {
    action: "product.created",
    entity: "Product",
    entityId: product.id,
    newData: product,
  });

  return product;
}
