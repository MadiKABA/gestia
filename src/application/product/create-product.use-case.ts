import type { TenantContext } from "@/domain/shared/tenant-context";
import { validateProductInput } from "@/domain/product/product.entity";
import { ForbiddenError } from "@/domain/shared/errors";
import type {
  ProductRepository,
  ResolvedProductInput,
} from "@/application/product/product.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/** Création réservée au patron (le vendeur ne peut que consulter/sélectionner
 * un produit, cf. CLAUDE.md Rôles). */
export async function createProduct(
  context: TenantContext,
  deps: { repository: ProductRepository; auditLogger: AuditLogger },
  id: string,
  input: ResolvedProductInput,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }
  validateProductInput(input);

  const product = await deps.repository.create(id, input);

  await deps.auditLogger.log(context, {
    action: "product.created",
    entity: "Product",
    entityId: product.id,
    newData: product,
  });

  return product;
}
