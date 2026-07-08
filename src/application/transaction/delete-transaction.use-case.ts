import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type { TransactionRepository } from "@/application/transaction/transaction.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/** Soft delete réservé au patron (cahier des charges §2 : le vendeur n'a
 * jamais accès à la suppression) — miroir exact de delete-party.use-case.ts. */
export async function deleteTransaction(
  context: TenantContext,
  deps: { repository: TransactionRepository; auditLogger: AuditLogger },
  id: string,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }

  const existing = await deps.repository.findById(id);
  if (!existing) {
    throw new NotFoundError("Transaction", id);
  }

  const deleted = await deps.repository.delete(id);

  await deps.auditLogger.log(context, {
    action: "transaction.deleted",
    entity: "Transaction",
    entityId: deleted.id,
    oldData: existing,
  });

  return deleted;
}
