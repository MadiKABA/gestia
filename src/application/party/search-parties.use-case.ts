import type { PartyRepository, PartySearchQuery } from "@/application/party/party.repository";

/**
 * `repository.findMany` retourne déjà le solde réel de chaque tiers
 * (PrismaPartyRepository compose PrismaTransactionRepository en interne,
 * voir infrastructure/party/party.repository.ts) — tri par solde
 * décroissant appliqué ici (cahier des charges §7).
 */
export async function searchParties(
  deps: { repository: PartyRepository },
  query: PartySearchQuery,
) {
  const parties = await deps.repository.findMany(query);
  return [...parties].sort((a, b) => b.balance - a.balance);
}
