import type { Payment, PaymentInput } from "@/domain/payment/payment.entity";
import { derivePaymentDirection, validatePaymentAmount } from "@/domain/payment/payment.entity";
import { deriveTransactionStatus, type Transaction } from "@/domain/transaction/transaction.entity";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import {
  getCachedEntity,
  listCachedEntities,
  setCachedEntity,
} from "@/infrastructure/offline/local-cache.store";
import { enqueueMutation } from "@/infrastructure/offline/mutation-queue.store";

const ENTITY = "payment";
const TRANSACTION_ENTITY = "transaction";

export type PaymentOfflineDeps = {
  tenantId: string;
  userId: string;
  /** Non bloquant, jamais attendu par l'appelant — voir TransactionOfflineRepository. */
  onSyncNeeded?: () => void;
};

/**
 * Repository offline-first du module Payment. Dévie volontairement de
 * `OfflineFirstRepository<T, TInput, TFilters>` (voir transaction/party) :
 * un paiement n'a ni `update` ni `delete` côté UI (jamais modifié ni
 * supprimé, cf. domain/payment/payment.entity.ts) — les forcer produirait du
 * code mort trompeur plutôt qu'une vraie garantie.
 *
 * Premier repository offline-first du projet à toucher DEUX entités en
 * cache dans une seule mutation optimiste : `create()` patch aussi l'entité
 * "transaction" déjà en cache (`paidAmount`/`status` recalculés via
 * `deriveTransactionStatus`, la même fonction que le serveur) pour un
 * affichage instantané cohérent — exactement ce que fera la vraie écriture
 * serveur une fois synchronisée (register-payment.use-case.ts), jamais
 * dupliqué autrement. Ne pas "corriger" ce comportement en le retirant,
 * c'est intentionnel.
 */
export class PaymentOfflineRepository {
  constructor(private readonly deps: PaymentOfflineDeps) {}

  async create(input: PaymentInput): Promise<Payment> {
    const cachedTransaction = await getCachedEntity<Transaction>(
      this.deps.tenantId,
      TRANSACTION_ENTITY,
      input.transactionId,
    );
    if (!cachedTransaction) {
      throw new Error("Transaction introuvable dans le cache local");
    }
    const transaction = cachedTransaction.data;
    const remainingBalance = transaction.amount - transaction.paidAmount;
    validatePaymentAmount(input.amount, remainingBalance);

    const id = generateClientId();
    const now = new Date();
    const payment: Payment = {
      id,
      tenantId: this.deps.tenantId,
      transactionId: input.transactionId,
      amount: input.amount,
      method: input.method,
      direction: derivePaymentDirection(transaction.type),
      note: input.note ?? null,
      createdById: this.deps.userId,
      createdAt: now,
    };
    await setCachedEntity(this.deps.tenantId, ENTITY, id, payment, now.toISOString());

    const newPaidAmount = transaction.paidAmount + input.amount;
    const updatedTransaction: Transaction = {
      ...transaction,
      paidAmount: newPaidAmount,
      status: deriveTransactionStatus(transaction.amount, newPaidAmount),
    };
    // Le `updatedAt` du RECORD de cache "transaction" reste le dernier
    // confirmé par le serveur, jamais celui de cette édition locale
    // optimiste — même règle que TransactionOfflineRepository.update.
    await setCachedEntity(
      this.deps.tenantId,
      TRANSACTION_ENTITY,
      input.transactionId,
      updatedTransaction,
      cachedTransaction.updatedAt,
    );

    await enqueueMutation({
      id: generateClientId(),
      tenantId: this.deps.tenantId,
      entity: ENTITY,
      action: "create",
      payload: input,
      clientGeneratedId: id,
      createdById: this.deps.userId,
    });
    this.deps.onSyncNeeded?.();

    return payment;
  }

  async getById(id: string): Promise<Payment | null> {
    const cached = await getCachedEntity<Payment>(this.deps.tenantId, ENTITY, id);
    return cached?.data ?? null;
  }

  /** Historique d'une transaction, ordre chronologique — pas de filtre
   * générique par `TFilters` (contrairement à Party/Transaction), un seul
   * usage existe pour ce module. */
  async list(transactionId: string): Promise<Payment[]> {
    const cached = await listCachedEntities<Payment>(this.deps.tenantId, ENTITY);
    return cached
      .map((c) => c.data)
      .filter((payment) => payment.transactionId === transactionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
