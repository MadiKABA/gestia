import type { Party, PartyInput, PartyType } from "@/domain/party/party.entity";

export type PartySearchQuery = {
  search?: string;
  type?: PartyType;
};

/** Tiers enrichi du solde temps réel (cahier des charges §7) — voir
 * `PartyRepository.findMany` pour l'état actuel de ce calcul. */
export type PartyWithBalance = Party & { balance: number };

/**
 * Contrat implémenté par src/infrastructure/party/party.repository.ts.
 * Toutes les méthodes sont implicitement bornées au tenant courant (le
 * repository concret est instancié avec le tenantId — voir TenantScopedRepository).
 */
export interface PartyRepository {
  findById(id: string): Promise<Party | null>;
  findMany(query: PartySearchQuery): Promise<PartyWithBalance[]>;
  create(input: PartyInput): Promise<Party>;
  update(id: string, input: PartyInput): Promise<Party>;
  /** Soft delete (`deletedAt`) — jamais de suppression définitive. */
  delete(id: string): Promise<Party>;
}
