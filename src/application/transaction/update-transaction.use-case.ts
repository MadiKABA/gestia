import type { TenantContext } from "@/domain/shared/tenant-context";
import type { TransactionUpdateInput } from "@/domain/transaction/transaction.entity";
import { validateTransactionInput } from "@/domain/transaction/transaction.entity";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
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
  // Modifier le montant d'une transaction déjà réglée en partie créerait une
  // incohérence entre `amount` et les paiements déjà enregistrés (cf.
  // CLAUDE.md, module Payment) — bloqué ici plutôt qu'uniquement masqué côté
  // UI, pour couvrir aussi bien la Server Action que la mutation offline.
  if (existing.paidAmount > 0) {
    throw new ValidationError(
      "Cette opération a déjà un paiement enregistré, elle ne peut plus être modifiée",
    );
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
