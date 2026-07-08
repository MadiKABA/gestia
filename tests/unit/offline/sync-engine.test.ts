import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { computeBackoffDelayMs, syncQueue } from "@/infrastructure/offline/sync-engine";
import {
  enqueueMutation,
  listPendingMutations,
} from "@/infrastructure/offline/mutation-queue.store";
import { getCachedEntity, setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncMutationResult } from "@/application/offline/sync-mutation.use-case";

function tenant() {
  return generateClientId();
}

describe("computeBackoffDelayMs", () => {
  it("double le délai à chaque tentative, plafonné à 60s", () => {
    expect(computeBackoffDelayMs(0)).toBe(2000);
    expect(computeBackoffDelayMs(1)).toBe(4000);
    expect(computeBackoffDelayMs(2)).toBe(8000);
    expect(computeBackoffDelayMs(10)).toBe(60000);
  });
});

describe("syncQueue", () => {
  it("synchronise toutes les mutations en attente dans l'ordre", async () => {
    const tenantId = tenant();
    const calls: string[] = [];
    await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: { name: "A" },
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });
    await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: { name: "B" },
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });

    const result = await syncQueue({
      tenantId,
      syncTransport: async (mutation: QueuedMutation) => {
        calls.push((mutation.payload as { name: string }).name);
        const data: SyncMutationResult = { updatedAt: new Date().toISOString(), conflict: false };
        return { ok: true, data };
      },
    });

    expect(result).toEqual({ succeeded: 2, remaining: 0, failed: false });
    expect(calls).toEqual(["A", "B"]);
    expect(await listPendingMutations(tenantId)).toHaveLength(0);
  });

  it("s'arrête à la première erreur sans traiter les mutations suivantes (ordre préservé)", async () => {
    const tenantId = tenant();
    const calls: string[] = [];
    await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: { name: "A" },
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });
    await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: { name: "B" },
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });

    const result = await syncQueue({
      tenantId,
      syncTransport: async (mutation: QueuedMutation) => {
        calls.push((mutation.payload as { name: string }).name);
        throw new Error("Network error");
      },
    });

    expect(calls).toEqual(["A"]);
    expect(result.failed).toBe(true);
    expect(result.succeeded).toBe(0);
    expect(result.remaining).toBe(2);
    expect(result.nextRetryDelayMs).toBe(4000); // 1er échec -> retryCount devient 1

    const pending = await listPendingMutations(tenantId);
    expect(pending).toHaveLength(2);
    expect(pending[0].retryCount).toBe(1);
    expect(pending[0].syncError).toBe("Network error");
  });

  it("relit clientKnownUpdatedAt depuis le cache local juste avant l'envoi (jamais figé à l'enfilement)", async () => {
    const tenantId = tenant();
    const clientGeneratedId = generateClientId();
    await setCachedEntity(
      tenantId,
      "party",
      clientGeneratedId,
      { name: "A" },
      "2026-01-01T00:00:00.000Z",
    );
    await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "update",
      payload: { name: "A modifié" },
      clientGeneratedId,
      createdById: "user-1",
    });

    let receivedUpdatedAt: string | undefined;
    await syncQueue({
      tenantId,
      syncTransport: async (mutation) => {
        receivedUpdatedAt = mutation.clientKnownUpdatedAt;
        return { ok: true, data: { updatedAt: "2026-01-02T00:00:00.000Z", conflict: false } };
      },
    });

    expect(receivedUpdatedAt).toBe("2026-01-01T00:00:00.000Z");

    // Le cache local doit refléter le nouvel updatedAt renvoyé par le serveur,
    // pour qu'une mutation suivante sur la même entité ne se signale pas un
    // faux conflit à elle-même.
    const cached = await getCachedEntity(tenantId, "party", clientGeneratedId);
    expect(cached?.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("utilise clientKnownUpdatedAt figé à l'enfilement pour une suppression (le cache n'existe déjà plus)", async () => {
    const tenantId = tenant();
    const clientGeneratedId = generateClientId();
    // Le cache est déjà vide au moment d'enfiler la mutation — comportement
    // réel de PartyOfflineRepository.delete(), qui retire le cache avant
    // d'enfiler, en figeant clientKnownUpdatedAt sur l'entrée elle-même.
    await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "delete",
      payload: {},
      clientGeneratedId,
      createdById: "user-1",
      clientKnownUpdatedAt: "2026-01-01T00:00:00.000Z",
    });

    let receivedUpdatedAt: string | undefined;
    const result = await syncQueue({
      tenantId,
      syncTransport: async (mutation) => {
        receivedUpdatedAt = mutation.clientKnownUpdatedAt;
        return { ok: true, data: { updatedAt: "2026-01-02T00:00:00.000Z", conflict: false } };
      },
    });

    expect(receivedUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.failed).toBe(false);
  });

  it("session expirée (ok:false) : mutation ni synchronisée ni marquée échouée, pas de backoff", async () => {
    const tenantId = tenant();
    await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: { name: "A" },
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });

    const result = await syncQueue({
      tenantId,
      syncTransport: async () => ({ ok: false, reason: "auth_required" }),
    });

    expect(result.failed).toBe(true);
    expect(result.reason).toBe("auth_required");
    expect(result.nextRetryDelayMs).toBeUndefined();

    const pending = await listPendingMutations(tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0].retryCount).toBe(0);
    expect(pending[0].syncError).toBeUndefined();
  });
});
