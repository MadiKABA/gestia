import { NotFoundError } from "@/domain/shared/errors";
import type { PartyRepository } from "@/application/party/party.repository";

/**
 * Historique des transactions du tiers — vide tant que le module transaction
 * n'existe pas (page détail affiche un état vide, pas une erreur).
 * // TODO: brancher le calcul réel une fois le module Transaction implémenté
 */
export async function getPartyById(deps: { repository: PartyRepository }, id: string) {
  const party = await deps.repository.findById(id);
  if (!party) {
    throw new NotFoundError("Party", id);
  }

  return { party, balance: 0, transactions: [] as never[] };
}
