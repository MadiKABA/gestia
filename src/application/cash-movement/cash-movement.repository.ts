import type { CashMovement, CashMovementInput } from "@/domain/cash-movement/cash-movement.entity";

export type CashMovementListQuery = { page: number; pageSize: number };

export type CashMovementListResult = {
  items: CashMovement[];
  total: number;
  hasMore: boolean;
};

/** Agrégat brut par type — le solde net (entrée - sortie) est calculé par
 * l'appelant, jamais dupliqué ici (même principe que
 * TransactionRepository.getBalanceSummary, qui laisse le signe au domaine). */
export type CashBalance = { totalEntree: number; totalSortie: number };

/**
 * Contrat implémenté par src/infrastructure/cash-movement/cash-movement.repository.ts.
 * Toutes les méthodes sont implicitement bornées au tenant courant (voir
 * TenantScopedRepository). `findChangedSince` (réservé au pull handler) n'est
 * volontairement pas ici — même choix que PaymentRepository, dont
 * findChangedSince vit uniquement sur l'implémentation Prisma concrète.
 */
export interface CashMovementRepository {
  findById(id: string): Promise<CashMovement | null>;
  findMany(query: CashMovementListQuery): Promise<CashMovementListResult>;
  /** `id` fourni par l'appelant (généré côté client hors ligne, devient l'id
   * définitif — même règle que TransactionRepository.create). */
  create(id: string, input: CashMovementInput, createdById: string): Promise<CashMovement>;
  getBalance(): Promise<CashBalance>;
}
