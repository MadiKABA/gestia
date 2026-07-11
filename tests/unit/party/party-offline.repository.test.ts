import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { PartyOfflineRepository } from "@/infrastructure/party/party-offline.repository";
import { getCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import type { PartyWithBalance } from "@/application/party/party.repository";

function tenant() {
  return generateClientId();
}

describe("PartyOfflineRepository — online-first", () => {
  it("create — en ligne, succès : écrit le cache avec l'updatedAt serveur, jamais mis en queue", async () => {
    const tenantId = tenant();
    const repository = new PartyOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => ({
        ok: true,
        data: { updatedAt: "2026-02-01T00:00:00.000Z", conflict: false },
      }),
    });

    const party = await repository.create({
      name: "Fatou Diop",
      phone: "+221771111111",
      type: "CLIENT",
    });

    expect(party.updatedAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
    const cached = await getCachedEntity<PartyWithBalance>(tenantId, "party", party.id);
    expect(cached?.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("create — en ligne, erreur de validation : rejette immédiatement, jamais mis en queue", async () => {
    const tenantId = tenant();
    const repository = new PartyOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => ({
        ok: false,
        reason: "validation_error",
        message: "Le nom est déjà utilisé",
      }),
    });

    await expect(
      repository.create({ name: "Fatou Diop", phone: "+221771111111", type: "CLIENT" }),
    ).rejects.toThrow("Le nom est déjà utilisé");
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
  });

  it("create — en ligne, erreur transitoire : repli sur le cache optimiste + la queue", async () => {
    const tenantId = tenant();
    const repository = new PartyOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => {
        throw new Error("network down");
      },
    });

    const party = await repository.create({
      name: "Fatou Diop",
      phone: "+221771111111",
      type: "CLIENT",
    });

    const pending = await listPendingMutations(tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0].clientGeneratedId).toBe(party.id);
  });

  it("create — hors ligne (aucun syncTransport fourni) : comportement inchangé", async () => {
    const tenantId = tenant();
    const repository = new PartyOfflineRepository({ tenantId, userId: "user-1" });

    const party = await repository.create({
      name: "Fatou Diop",
      phone: "+221771111111",
      type: "CLIENT",
    });

    expect(await listPendingMutations(tenantId)).toHaveLength(1);
    expect(party.id).toBeDefined();
  });

  it("update — en ligne, succès : transmet clientKnownUpdatedAt lu du cache, écrit le cache confirmé", async () => {
    const tenantId = tenant();
    // Créé en ligne (succès direct, pas de queue) pour partir d'un état
    // propre — seule la mutation `update` nous intéresse ici.
    const creationRepo = new PartyOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async () => ({
        ok: true,
        data: { updatedAt: "2026-02-01T00:00:00.000Z", conflict: false },
      }),
    });
    const created = await creationRepo.create({
      name: "Moussa Sarr",
      phone: "+221771111112",
      type: "SUPPLIER",
    });
    const createdCache = await getCachedEntity<PartyWithBalance>(tenantId, "party", created.id);

    let receivedClientKnownUpdatedAt: string | undefined;
    const repository = new PartyOfflineRepository({
      tenantId,
      userId: "user-1",
      syncTransport: async (mutation) => {
        receivedClientKnownUpdatedAt = mutation.clientKnownUpdatedAt;
        return { ok: true, data: { updatedAt: "2026-03-01T00:00:00.000Z", conflict: false } };
      },
    });

    const updated = await repository.update(created.id, {
      name: "Moussa Sarr (modifié)",
      phone: "+221771111112",
      type: "SUPPLIER",
    });

    expect(receivedClientKnownUpdatedAt).toBe(createdCache?.updatedAt);
    expect(updated.name).toBe("Moussa Sarr (modifié)");
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
  });
});
