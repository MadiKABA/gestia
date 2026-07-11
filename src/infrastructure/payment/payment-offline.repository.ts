import type { Payment, PaymentInput } from "@/domain/payment/payment.entity";
import { derivePaymentDirection, validatePaymentAmount } from "@/domain/payment/payment.entity";
import { deriveTransactionStatus, type Transaction } from "@/domain/transaction/transaction.entity";
import { ValidationError } from "@/domain/shared/errors";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncTransport } from "@/infrastructure/offline/sync-engine";
import { attemptOnlineMutation } from "@/infrastructure/offline/online-first-mutation";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import {
  getCachedEntity,
  listCachedEntities,
  setCachedEntity,
} from "@/infrastructure/offline/local-cache.store";
import { enqueueMutation } from "@/infrastructure/offline/mutation-queue.store";
import { isOnline } from "@/infrastructure/offline/platform";

const ENTITY = "payment";
const TRANSACTION_ENTITY = "transaction";

export type PaymentOfflineDeps = {
  tenantId: string;
  userId: string;
  /** Même transport que la sync différée — voir PartyOfflineRepository
   * (optionnel : absent, la tentative directe est simplement sautée). */
  syncTransport?: SyncTransport;
  /** Non bloquant, jamais attendu par l'appelant — voir TransactionOfflineRepository. */
  onSyncNeeded?: () => void;
};

/**
 * Repository "online-first, repli offline" du module Payment. Dévie
 * volontairement de `OfflineFirstRepository<T, TInput, TFilters>` (voir
 * transaction/party) : un paiement n'a ni `update` ni `delete` côté UI
 * (jamais modifié ni supprimé, cf. domain/payment/payment.entity.ts) — les
 * forcer produirait du code mort trompeur plutôt qu'une vraie garantie.
 *
 * C'est ce module qui a révélé le bug corrigé par le passage en
 * online-first : `validatePaymentAmount` valide contre le solde du cache
 * local, potentiellement périmé (un autre appareil a pu régler la
 * transaction entre-temps) — en ligne, la tentative directe
 * (attemptOnlineMutation) fait foi contre l'état réel du serveur, cette
 * validation locale ne reste qu'un filtre de confort avant l'aller-retour
 * réseau, jamais la source de vérité. Premier repository offline-first du
 * projet à toucher DEUX entités en cache dans une seule mutation optimiste :
 * `create()` patch aussi l'entité "transaction" déjà en cache
 * (`paidAmount`/`status` recalculés via `deriveTransactionStatus`, la même
 * fonction que le serveur) pour un affichage instantané cohérent — exactement
 * ce que fera la vraie écriture serveur une fois synchronisée
 * (register-payment.use-case.ts), jamais dupliqué autrement. Ne pas
 * "corriger" ce comportement en le retirant, c'est intentionnel.
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

    const newPaidAmount = transaction.paidAmount + input.amount;
    const updatedTransaction: Transaction = {
      ...transaction,
      paidAmount: newPaidAmount,
      status: deriveTransactionStatus(transaction.amount, newPaidAmount),
    };

    if (isOnline() && this.deps.syncTransport) {
      const mutation: QueuedMutation = {
        id: generateClientId(),
        tenantId: this.deps.tenantId,
        entity: ENTITY,
        action: "create",
        payload: input,
        clientGeneratedId: id,
        createdAt: now.toISOString(),
        createdById: this.deps.userId,
      };
      const result = await attemptOnlineMutation(this.deps.syncTransport, mutation);
      if (result.status === "validation_error" || result.status === "dependency_not_found") {
        // Même rationale que TransactionOfflineRepository : une tentative en
        // ligne directe n'a pas de "prochaine mutation en queue" qui
        // pourrait encore résoudre la dépendance manquante.
        throw new ValidationError(result.message);
      }
      if (result.status === "success") {
        // `result.updatedAt` est ici le `createdAt` réel du paiement côté
        // serveur (voir payment-mutation-handler.ts), donc plus fiable que
        // le `now` client posé plus haut.
        const confirmedPayment = { ...payment, createdAt: new Date(result.updatedAt) };
        await setCachedEntity(this.deps.tenantId, ENTITY, id, confirmedPayment, result.updatedAt);
        // Le `updatedAt` du RECORD de cache "transaction" reste le dernier
        // confirmé par le serveur (pas encore celui-ci) — la vraie valeur
        // arrive via le pull générique déclenché juste après, même règle
        // que le chemin hors ligne ci-dessous.
        await setCachedEntity(
          this.deps.tenantId,
          TRANSACTION_ENTITY,
          input.transactionId,
          updatedTransaction,
          cachedTransaction.updatedAt,
        );
        this.deps.onSyncNeeded?.();
        return confirmedPayment;
      }
      // "transient_error" : repli sur le chemin hors ligne ci-dessous.
    }

    await setCachedEntity(this.deps.tenantId, ENTITY, id, payment, now.toISOString());
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
