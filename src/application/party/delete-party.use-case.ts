import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/shared/errors";
import type { PartyRepository } from "@/application/party/party.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Soft delete réservé au patron (cahier des charges §2 : le vendeur n'a
 * jamais accès à la suppression).
 *
 * `hasOpenTransactions` est un contrat fonctionnel local (pas un import de
 * `application/transaction`) : `application/party` ne dépend jamais de
 * `application/transaction`, seul le composition root
 * (`infrastructure/party/party-mutation-handler.ts`) connaît les deux
 * côtés et injecte l'implémentation réelle
 * (`TransactionRepository.hasOpenTransactionsForParty`). Volontairement
 * obligatoire, pas optionnel : un `?` inviterait un oubli de câblage qui
 * recréerait le bug que cette dépendance corrige.
 */
export async function deleteParty(
  context: TenantContext,
  deps: {
    repository: PartyRepository;
    auditLogger: AuditLogger;
    hasOpenTransactions: (partyId: string) => Promise<boolean>;
  },
  id: string,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }

  const existing = await deps.repository.findById(id);
  if (!existing) {
    throw new NotFoundError("Party", id);
  }

  if (await deps.hasOpenTransactions(id)) {
    throw new ValidationError(
      "Impossible de supprimer ce client : il a des créances ou dettes non soldées.",
    );
  }

  const deleted = await deps.repository.delete(id);

  await deps.auditLogger.log(context, {
    action: "party.deleted",
    entity: "Party",
    entityId: deleted.id,
    oldData: existing,
  });

  return deleted;
}
