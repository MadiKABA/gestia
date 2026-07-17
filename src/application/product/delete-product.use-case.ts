import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type { ProductRepository } from "@/application/product/product.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/** Soft delete réservé au patron (cahier des charges §2 : le vendeur n'a
 * jamais accès à la suppression). */
export async function deleteProduct(
  context: TenantContext,
  deps: { repository: ProductRepository; auditLogger: AuditLogger },
  id: string,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }

  const existing = await deps.repository.findById(id);
  if (!existing) {
    throw new NotFoundError("Product", id);
  }

  const deleted = await deps.repository.delete(id);

  await deps.auditLogger.log(context, {
    action: "product.deleted",
    entity: "Product",
    entityId: deleted.id,
    oldData: existing,
  });

  return deleted;
}
