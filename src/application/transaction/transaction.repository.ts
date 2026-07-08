import type {
  Transaction,
  TransactionInput,
  TransactionStatus,
  TransactionType,
  TransactionUpdateInput,
} from "@/domain/transaction/transaction.entity";

export type TransactionSearchQuery = {
  partyId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  search?: string;
};

/**
 * Contrat implémenté par src/infrastructure/transaction/transaction.repository.ts.
 * Toutes les méthodes sont implicitement bornées au tenant courant (voir
 * TenantScopedRepository), à l'image de PartyRepository.
 */
export interface TransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findMany(query: TransactionSearchQuery): Promise<Transaction[]>;
  /** Historique complet d'un tiers (vue détail Party) — jamais paginé, un
   * commerçant n'a pas des milliers de transactions par client. */
  findByParty(partyId: string): Promise<Transaction[]>;
  /**
   * `id` fourni par l'appelant (généré côté client hors ligne, devient l'id
   * définitif — même règle que PartyRepository.create). `createdById`
   * distinct de `PartyRepository.create` : Transaction porte une relation
   * `createdBy` que Party n'a pas.
   */
  create(id: string, input: TransactionInput, createdById: string): Promise<Transaction>;
  update(id: string, input: TransactionUpdateInput): Promise<Transaction>;
  /** Soft delete (`deletedAt`) — jamais de suppression définitive. */
  delete(id: string): Promise<Transaction>;
  /** Vrai si le tiers a au moins une transaction non soldée (EN_COURS ou
   * PARTIELLE) — utilisé par delete-party.use-case.ts pour bloquer la
   * suppression d'un client encore engagé. */
  hasOpenTransactionsForParty(partyId: string): Promise<boolean>;
}
