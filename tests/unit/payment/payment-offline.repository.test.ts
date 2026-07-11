import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { PaymentOfflineRepository } from "@/infrastructure/payment/payment-offline.repository";
import { getCachedEntity, setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import type { Transaction } from "@/domain/transaction/transaction.entity";

function tenant() {
  return generateClientId();
}

async function seedTransaction(
  tenantId: string,
  overrides: Partial<Transaction> = {},
): Promise<Transaction> {
  const now = new Date();
  const transaction: Transaction = {
    id: generateClientId(),
    tenantId,
    reference: "CR-2026-00001",
    partyId: generateClientId(),
    type: "CREANCE",
    description: "Vente de riz",
    quantity: null,
    amount: 10000,
    paidAmount: 0,
    dueDate: null,
    status: "EN_COURS",
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  await setCachedEntity(tenantId, "transaction", transaction.id, transaction, now.toISOString());
  return transaction;
}

/**
 * Couvre le bug corrigé par le passage online-first : PaymentOfflineRepository
 * validait un paiement contre le solde du cache local (potentiellement
 * périmé), l'enfilait, puis échouait silencieusement en boucle à la sync
 * différée si le serveur le rejetait entre-temps (voir commit "fix(offline-sync):
 * nettoyage de la mutation payment bloquée en erreur permanente").
 */
describe("PaymentOfflineRepository — online-first", () => {
  it("en ligne, succès : écrit le cache (paiement + transaction) avec l'updatedAt serveur, jamais mis en queue", async () => {
    const tenantId = tenant();
    const transaction = await seedTransaction(tenantId);
    const repository = new PaymentOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => ({
        ok: true,
        data: { updatedAt: "2026-02-01T00:00:00.000Z", conflict: false },
      }),
    });

    const payment = await repository.create({
      transactionId: transaction.id,
      amount: 4000,
      method: "CASH",
    });

    expect(payment.createdAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(await listPendingMutations(tenantId)).toHaveLength(0);

    const cachedTransaction = await getCachedEntity<Transaction>(
      tenantId,
      "transaction",
      transaction.id,
    );
    expect(cachedTransaction?.data.paidAmount).toBe(4000);
  });

  it("en ligne, erreur de validation serveur (solde périmé côté cache) : rejette immédiatement, jamais mis en queue", async () => {
    const tenantId = tenant();
    // Le cache local croit qu'il reste 10000 à régler...
    const transaction = await seedTransaction(tenantId, { amount: 10000, paidAmount: 0 });
    const repository = new PaymentOfflineRepository({
      tenantId,
      userId: "user-1",
      // ...mais le serveur sait qu'un autre appareil a déjà tout réglé.
      syncTransport: async () => ({
        ok: false,
        reason: "validation_error",
        message: "Le montant ne peut pas dépasser le solde restant",
      }),
    });

    await expect(
      repository.create({ transactionId: transaction.id, amount: 4000, method: "CASH" }),
    ).rejects.toThrow("Le montant ne peut pas dépasser le solde restant");

    expect(await listPendingMutations(tenantId)).toHaveLength(0);
  });

  it("en ligne, erreur transitoire (réseau) : repli sur le cache optimiste + la queue, comme hors ligne", async () => {
    const tenantId = tenant();
    const transaction = await seedTransaction(tenantId);
    const repository = new PaymentOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => {
        throw new Error("network down");
      },
    });

    const payment = await repository.create({
      transactionId: transaction.id,
      amount: 4000,
      method: "CASH",
    });

    const pending = await listPendingMutations(tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0].clientGeneratedId).toBe(payment.id);
  });

  it("hors ligne (aucun syncTransport fourni) : cache optimiste + queue, comportement inchangé", async () => {
    const tenantId = tenant();
    const transaction = await seedTransaction(tenantId);
    const repository = new PaymentOfflineRepository({ tenantId, userId: "user-1" });

    const payment = await repository.create({
      transactionId: transaction.id,
      amount: 4000,
      method: "CASH",
    });

    expect(await listPendingMutations(tenantId)).toHaveLength(1);
    const cachedTransaction = await getCachedEntity<Transaction>(
      tenantId,
      "transaction",
      transaction.id,
    );
    expect(cachedTransaction?.data.paidAmount).toBe(4000);
    expect(payment.id).toBeDefined();
  });
});
