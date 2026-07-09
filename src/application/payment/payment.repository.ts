import type { CashMovementType } from "@/domain/cash-movement/cash-movement.entity";
import type { Payment, PaymentDirection, PaymentMethod } from "@/domain/payment/payment.entity";
import type { Transaction, TransactionStatus } from "@/domain/transaction/transaction.entity";

/** Tout calculé par register-payment.use-case.ts (application) avant
 * d'atteindre l'infra — le repository n'y applique plus aucune règle
 * métier, seulement l'écriture atomique. */
export type PaymentRegistrationInput = {
  transactionId: string;
  amount: number;
  method: PaymentMethod;
  direction: PaymentDirection;
  note: string | null;
  newPaidAmount: number;
  newStatus: TransactionStatus;
  cashMovement: { type: CashMovementType; reason: string } | null;
};

export type PaymentRegistrationResult = {
  payment: Payment;
  transaction: Transaction;
  cashMovementId: string | null;
};

/**
 * Contrat implémenté par src/infrastructure/payment/payment.repository.ts.
 * `register` écrit Payment, la mise à jour de Transaction.paidAmount/status
 * et le CashMovement (si paiement CASH) en une seule opération atomique —
 * voir le commentaire de PrismaPaymentRepository.register pour pourquoi ce
 * choix plutôt qu'un module application/cash-movement séparé.
 */
export interface PaymentRepository {
  findById(id: string): Promise<Payment | null>;
  findByTransactionId(transactionId: string): Promise<Payment[]>;
  register(
    id: string,
    input: PaymentRegistrationInput,
    createdById: string,
  ): Promise<PaymentRegistrationResult>;
  /** Dernier paiement de chaque transaction (colonne "Mode de paiement" de
   * la liste unifiée) — une seule requête batchée plutôt qu'un
   * `findByTransactionId` par ligne affichée. */
  findLatestByTransactionIds(transactionIds: string[]): Promise<Map<string, Payment>>;
}
