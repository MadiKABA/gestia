import { NotFoundError } from "@/domain/shared/errors";
import type { PartyRepository } from "@/application/party/party.repository";
import type { TransactionRepository } from "@/application/transaction/transaction.repository";
import { computePartyBalance } from "@/domain/transaction/transaction.entity";

/**
 * Historique complet des transactions du tiers + solde net dérivé de cette
 * même liste (jamais un second calcul d'agrégation séparé) : garantit que
 * le solde affiché correspond exactement aux transactions listées juste en
 * dessous, sans risque de divergence entre deux règles de calcul.
 */
export async function getPartyById(
  deps: { repository: PartyRepository; transactionRepository: TransactionRepository },
  id: string,
) {
  const party = await deps.repository.findById(id);
  if (!party) {
    throw new NotFoundError("Party", id);
  }

  const transactions = await deps.transactionRepository.findByParty(id);

  return { party, balance: computePartyBalance(transactions), transactions };
}
