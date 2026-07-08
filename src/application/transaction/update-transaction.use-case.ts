import type { TenantContext } from "@/domain/shared/tenant-context";
import type { TransactionUpdateInput } from "@/domain/transaction/transaction.entity";
import { validateTransactionInput } from "@/domain/transaction/transaction.entity";
import { NotFoundError } from "@/domain/shared/errors";
import type { TransactionRepository } from "@/application/transaction/transaction.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

export async function updateTransaction(
  context: TenantContext,
  deps: { repository: TransactionRepository; auditLogger: AuditLogger },
  id: string,
  input: TransactionUpdateInput,
) {
  validateTransactionInput(input);

  const existing = await deps.repository.findById(id);
  if (!existing) {
    throw new NotFoundError("Transaction", id);
  }

  const updated = await deps.repository.update(id, input);

  await deps.auditLogger.log(context, {
    action: "transaction.updated",
    entity: "Transaction",
    entityId: updated.id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}
