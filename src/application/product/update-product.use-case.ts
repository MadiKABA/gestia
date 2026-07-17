import type { TenantContext } from "@/domain/shared/tenant-context";
import { validateProductInput } from "@/domain/product/product.entity";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type {
  ProductRepository,
  ResolvedProductInput,
} from "@/application/product/product.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

export async function updateProduct(
  context: TenantContext,
  deps: { repository: ProductRepository; auditLogger: AuditLogger },
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
