import type { Party, PartyInput } from "@/domain/party/party.entity";

export type PartySearchQuery = {
  search?: string;
};

/**
 * Contrat implémenté par src/infrastructure/party/party.repository.ts.
 * Toutes les méthodes sont implicitement bornées au tenant courant (le
 * repository concret est instancié avec le tenantId — voir TenantScopedRepository).
 */
export interface PartyRepository {
  findById(id: string): Promise<Party | null>;
  findMany(query: PartySearchQuery): Promise<Party[]>;
  create(input: PartyInput): Promise<Party>;
  update(id: string, input: PartyInput): Promise<Party>;
}
