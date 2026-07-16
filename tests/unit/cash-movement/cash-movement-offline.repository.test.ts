import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CashMovementOfflineRepository } from "@/infrastructure/cash-movement/cash-movement-offline.repository";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import { getMutation, listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";

function tenant() {
  return generateClientId();
}

function fakeInput() {
  return { type: "ENTREE" as const, amount: 5000, reason: "Apport personnel" };
}

describe("CashMovementOfflineRepository — online-first", () => {
  it("create — en ligne, succès : écrit le cache avec la date serveur, jamais mis en queue", async () => {
    const tenantId = tenant();
    const repository = new CashMovementOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => ({
        ok: true,
        data: { updatedAt: "2026-02-01T00:00:00.000Z", conflict: false },
      }),
    });

    const movement = await repository.create(fakeInput());

    expect(movement.date.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
  });

  it("create — en ligne, erreur de validation : rejette immédiatement, jamais mis en queue", async () => {
    const tenantId = tenant();
    const repository = new CashMovementOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => ({
        ok: false,
        reason: "validation_error",
        message: "Le motif est obligatoire",
      }),
    });

    await expect(repository.create(fakeInput())).rejects.toThrow("Le motif est obligatoire");
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
  });

  it("create — en ligne, erreur transitoire : repli sur le cache optimiste + la queue", async () => {
    const tenantId = tenant();
    const repository = new CashMovementOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => {
        throw new Error("network down");
      },
    });

    const movement = await repository.create(fakeInput());

    const pending = await listPendingMutations(tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0].clientGeneratedId).toBe(movement.id);
  });

  it("create — hors ligne (aucun syncTransport fourni) : comportement inchangé", async () => {
    const tenantId = tenant();
    const repository = new CashMovementOfflineRepository({ tenantId, userId: "user-1" });

    const movement = await repository.create(fakeInput());

    expect(await listPendingMutations(tenantId)).toHaveLength(1);
    expect(movement.id).toBeDefined();
  });

  it("create — vente au comptant, en ligne : partyId/method transmis au serveur et présents dans l'objet retourné", async () => {
    const tenantId = tenant();
    const repository = new CashMovementOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => ({
        ok: true,
        data: { updatedAt: "2026-02-01T00:00:00.000Z", conflict: false },
      }),
    });

    const movement = await repository.create({
      type: "ENTREE",
      amount: 5000,
      reason: "2 sacs de riz",
      method: "WAVE",
      partyId: "party-1",
    });

    expect(movement.partyId).toBe("party-1");
    expect(movement.method).toBe("WAVE");
  });

  it("create — vente au comptant, hors ligne : partyId/method préservés dans l'objet optimiste ET dans le payload de la mutation enfilée", async () => {
    const tenantId = tenant();
    const repository = new CashMovementOfflineRepository({ tenantId, userId: "user-1" });

    const movement = await repository.create({
      type: "ENTREE",
      amount: 5000,
      reason: "2 sacs de riz",
      method: "ORANGE_MONEY",
      partyId: "party-1",
    });

    expect(movement.partyId).toBe("party-1");
    expect(movement.method).toBe("ORANGE_MONEY");

    const pending = await listPendingMutations(tenantId);
    const mutation = await getMutation(pending[0].id);
    expect(mutation?.payload).toMatchObject({ partyId: "party-1", method: "ORANGE_MONEY" });
  });
});
