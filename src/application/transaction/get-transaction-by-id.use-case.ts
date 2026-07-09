import { NotFoundError } from "@/domain/shared/errors";
import type { TransactionRepository } from "@/application/transaction/transaction.repository";
import type { PartyRepository } from "@/application/party/party.repository";

/** Résout les infos du tiers pour l'affichage (nom, contact WhatsApp)
 * plutôt que de dénormaliser Party dans le type domain Transaction (jamais
 * de couplage dans l'autre sens). */
export async function getTransactionById(
  deps: { repository: TransactionRepository; partyRepository: PartyRepository },
  id: string,
) {
  const transaction = await deps.repository.findById(id);
  if (!transaction) {
    throw new NotFoundError("Transaction", id);
  }

  const party = await deps.partyRepository.findById(transaction.partyId);

  return {
    transaction,
    party: party
      ? { name: party.name, phone: party.phone, whatsappNumber: party.whatsappNumber }
      : null,
  };
}
