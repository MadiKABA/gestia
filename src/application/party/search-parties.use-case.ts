import type { PartyRepository, PartySearchQuery } from "@/application/party/party.repository";

/**
 * NB : le tri par solde décroissant (cahier des charges §7) dépend de
 * l'agrégation des Transaction liées à chaque Party ; il sera ajouté lors de
 * l'implémentation du module transaction, en composition avec cette recherche.
 */
export async function searchParties(
  deps: { repository: PartyRepository },
  query: PartySearchQuery,
) {
  return deps.repository.findMany(query);
}
