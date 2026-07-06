import type { PartyRepository, PartySearchQuery } from "@/application/party/party.repository";

/**
 * Le solde de chaque tiers dépend de l'agrégation des Transaction liées ; le
 * repository le retourne à 0 pour l'instant (TODO branché au module
 * transaction). Le tri par solde décroissant est déjà appliqué ici pour ne
 * pas avoir à retoucher ce use case une fois le calcul réel disponible.
 */
export async function searchParties(
  deps: { repository: PartyRepository },
  query: PartySearchQuery,
) {
  const parties = await deps.repository.findMany(query);
  return [...parties].sort((a, b) => b.balance - a.balance);
}
