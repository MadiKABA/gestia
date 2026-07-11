import type { TenantContext } from "@/domain/shared/tenant-context";
import type { TransactionInput } from "@/domain/transaction/transaction.entity";
import { validateTransactionInput } from "@/domain/transaction/transaction.entity";
import { DependencyNotFoundError } from "@/domain/shared/errors";
import type { TransactionRepository } from "@/application/transaction/transaction.repository";
import type { PartyRepository } from "@/application/party/party.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Ouvert à PATRON et VENDEUR (cahier des charges §2 : le vendeur a accès aux
 * créances/dettes, seule la suppression lui est refusée — voir
 * delete-transaction.use-case.ts).
 */
export async function createTransaction(
  context: TenantContext,
  deps: {
    repository: TransactionRepository;
    partyRepository: PartyRepository;
    auditLogger: AuditLogger;
  },
  id: string,
  input: TransactionInput,
) {
  validateTransactionInput(input);

  const party = await deps.partyRepository.findById(input.partyId);
  if (!party) {
    // Distinct d'un NotFoundError ordinaire : `partyId` peut référencer un
    // Party créé hors ligne dans la même session, pas encore synchronisé —
    // voir DependencyNotFoundError et infrastructure/offline/sync-engine.ts.
    throw new DependencyNotFoundError("Party", input.partyId);
  }

  const transaction = await deps.repository.create(id, input, context.userId);

  await deps.auditLogger.log(context, {
    action: "transaction.created",
    entity: "Transaction",
    entityId: transaction.id,
    newData: transaction,
  });

  return transaction;
}
