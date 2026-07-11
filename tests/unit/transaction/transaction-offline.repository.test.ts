import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { TransactionOfflineRepository } from "@/infrastructure/transaction/transaction-offline.repository";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";

function tenant() {
  return generateClientId();
}

function fakeInput() {
  return {
    partyId: generateClientId(),
    type: "CREANCE" as const,
    description: "Vente de riz",
    amount: 10000,
  };
}

describe("TransactionOfflineRepository — online-first", () => {
  it("create — en ligne, succès : écrit le cache avec l'updatedAt serveur, jamais mis en queue", async () => {
    const tenantId = tenant();
    const repository = new TransactionOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => ({
        ok: true,
        data: { updatedAt: "2026-02-01T00:00:00.000Z", conflict: false },
      }),
    });

    const transaction = await repository.create(fakeInput());

    expect(transaction.updatedAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
  });

  it("create — en ligne, erreur de validation : rejette immédiatement, jamais mis en queue", async () => {
    const tenantId = tenant();
    const repository = new TransactionOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => ({
        ok: false,
        reason: "validation_error",
        message: "Le montant doit être supérieur à zéro",
      }),
    });

    await expect(repository.create(fakeInput())).rejects.toThrow(
      "Le montant doit être supérieur à zéro",
    );
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
  });

  it("create — en ligne, erreur transitoire : repli sur le cache optimiste + la queue", async () => {
    const tenantId = tenant();
    const repository = new TransactionOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => {
        throw new Error("network down");
      },
    });

    const transaction = await repository.create(fakeInput());

    const pending = await listPendingMutations(tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0].clientGeneratedId).toBe(transaction.id);
  });

  it("create — hors ligne (aucun syncTransport fourni) : comportement inchangé", async () => {
    const tenantId = tenant();
    const repository = new TransactionOfflineRepository({ tenantId, userId: "user-1" });

    const transaction = await repository.create(fakeInput());

    expect(await listPendingMutations(tenantId)).toHaveLength(1);
    expect(transaction.reference).toBeNull();
  });
});
