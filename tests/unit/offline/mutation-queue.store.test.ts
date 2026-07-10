import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  discardMutation,
  enqueueMutation,
  getMutation,
  hasPendingMutationFor,
  listFailedMutations,
  listPendingMutations,
  markMutationFailed,
  markMutationPermanentlyFailed,
  markMutationSynced,
  purgeSyncedMutations,
} from "@/infrastructure/offline/mutation-queue.store";
import { getCachedEntity, setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { generateClientId } from "@/infrastructure/offline/id-generator";

/** tenantId unique par test : évite d'avoir à réinitialiser la base fake-indexeddb entre les tests. */
function tenant() {
  return generateClientId();
}

describe("mutation-queue.store", () => {
  it("enfile une mutation puis la retrouve dans les mutations en attente", async () => {
    const tenantId = tenant();
    const record = await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: { name: "Fatou Diop" },
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });

    expect(record.synced).toBe(false);
    expect(record.retryCount).toBe(0);

    const pending = await listPendingMutations(tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(record.id);
  });

  it("respecte l'ordre chronologique de création", async () => {
    const tenantId = tenant();
    const first = await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: {},
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });
    const second = await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: {},
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });

    const pending = await listPendingMutations(tenantId);
    expect(pending.map((m) => m.id)).toEqual([first.id, second.id]);
  });

  it("une mutation synchronisée disparaît des mutations en attente", async () => {
    const tenantId = tenant();
    const record = await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: {},
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });

    await markMutationSynced(record.id, new Date().toISOString());

    const pending = await listPendingMutations(tenantId);
    expect(pending).toHaveLength(0);
  });

  it("un échec incrémente retryCount et garde la mutation en attente (jamais perdue)", async () => {
    const tenantId = tenant();
    const record = await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: {},
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });

    await markMutationFailed(record.id, "Network error");
    await markMutationFailed(record.id, "Network error");

    const pending = await listPendingMutations(tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0].retryCount).toBe(2);
    expect(pending[0].syncError).toBe("Network error");
  });

  it("isole les mutations en attente par tenant", async () => {
    const tenantA = tenant();
    const tenantB = tenant();
    await enqueueMutation({
      id: generateClientId(),
      tenantId: tenantA,
      entity: "party",
      action: "create",
      payload: {},
      clientGeneratedId: generateClientId(),
      createdById: "user-1",
    });

    const pendingB = await listPendingMutations(tenantB);
    expect(pendingB).toHaveLength(0);
  });

  describe("hasPendingMutationFor", () => {
    it("vrai tant qu'une mutation sur cette entité n'est pas synchronisée", async () => {
      const tenantId = tenant();
      const clientGeneratedId = generateClientId();
      await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "party",
        action: "update",
        payload: {},
        clientGeneratedId,
        createdById: "user-1",
      });

      expect(await hasPendingMutationFor(tenantId, "party", clientGeneratedId)).toBe(true);
    });

    it("faux une fois la mutation synchronisée", async () => {
      const tenantId = tenant();
      const clientGeneratedId = generateClientId();
      const record = await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "party",
        action: "update",
        payload: {},
        clientGeneratedId,
        createdById: "user-1",
      });
      await markMutationSynced(record.id, new Date().toISOString());

      expect(await hasPendingMutationFor(tenantId, "party", clientGeneratedId)).toBe(false);
    });

    it("faux pour une entity différente portant le même id", async () => {
      const tenantId = tenant();
      const clientGeneratedId = generateClientId();
      await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "party",
        action: "update",
        payload: {},
        clientGeneratedId,
        createdById: "user-1",
      });

      expect(await hasPendingMutationFor(tenantId, "transaction", clientGeneratedId)).toBe(false);
    });
  });

  describe("markMutationPermanentlyFailed / listFailedMutations", () => {
    it("sort une mutation de listPendingMutations et la fait apparaître dans listFailedMutations", async () => {
      const tenantId = tenant();
      const record = await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "payment",
        action: "create",
        payload: { amount: 5000 },
        clientGeneratedId: generateClientId(),
        createdById: "user-1",
      });

      await markMutationPermanentlyFailed(
        record.id,
        "Le montant ne peut pas dépasser le solde restant",
      );

      expect(await listPendingMutations(tenantId)).toHaveLength(0);
      const failed = await listFailedMutations(tenantId);
      expect(failed).toHaveLength(1);
      expect(failed[0].id).toBe(record.id);
      expect(failed[0].syncError).toBe("Le montant ne peut pas dépasser le solde restant");
      expect(failed[0].synced).toBe(false);
    });

    it("isole les échecs définitifs par tenant", async () => {
      const tenantA = tenant();
      const tenantB = tenant();
      const record = await enqueueMutation({
        id: generateClientId(),
        tenantId: tenantA,
        entity: "payment",
        action: "create",
        payload: {},
        clientGeneratedId: generateClientId(),
        createdById: "user-1",
      });
      await markMutationPermanentlyFailed(record.id, "Erreur");

      expect(await listFailedMutations(tenantB)).toHaveLength(0);
    });
  });

  describe("discardMutation", () => {
    it("supprime une mutation create en échec ET l'entité fantôme correspondante du cache", async () => {
      const tenantId = tenant();
      const clientGeneratedId = generateClientId();
      const record = await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "payment",
        action: "create",
        payload: { amount: 5000 },
        clientGeneratedId,
        createdById: "user-1",
      });
      await setCachedEntity(
        tenantId,
        "payment",
        clientGeneratedId,
        { amount: 5000 },
        new Date().toISOString(),
      );
      await markMutationPermanentlyFailed(record.id, "Erreur définitive");

      await discardMutation(record.id);

      expect(await getMutation(record.id)).toBeUndefined();
      expect(await getCachedEntity(tenantId, "payment", clientGeneratedId)).toBeUndefined();
    });

    it("supprime une mutation update/delete en échec sans toucher au cache (corrigé par le prochain pull)", async () => {
      const tenantId = tenant();
      const clientGeneratedId = generateClientId();
      const record = await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "party",
        action: "update",
        payload: { name: "Modifié hors ligne" },
        clientGeneratedId,
        createdById: "user-1",
      });
      await setCachedEntity(
        tenantId,
        "party",
        clientGeneratedId,
        { name: "Modifié hors ligne" },
        new Date().toISOString(),
      );
      await markMutationPermanentlyFailed(record.id, "Erreur définitive");

      await discardMutation(record.id);

      expect(await getMutation(record.id)).toBeUndefined();
      expect(await getCachedEntity(tenantId, "party", clientGeneratedId)).toBeDefined();
    });

    it("ne fait rien pour un id inconnu", async () => {
      await expect(discardMutation(generateClientId())).resolves.toBeUndefined();
    });
  });

  describe("purgeSyncedMutations", () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    it("supprime une mutation synced dont syncedAt dépasse la rétention", async () => {
      const tenantId = tenant();
      const record = await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "party",
        action: "create",
        payload: {},
        clientGeneratedId: generateClientId(),
        createdById: "user-1",
      });
      const eightDaysAgo = new Date(Date.now() - 8 * ONE_DAY_MS).toISOString();
      await markMutationSynced(record.id, eightDaysAgo);

      const purged = await purgeSyncedMutations(tenantId, 7 * ONE_DAY_MS);

      expect(purged).toBe(1);
      expect(await getMutation(record.id)).toBeUndefined();
    });

    it("garde une mutation synced encore dans la fenêtre de rétention", async () => {
      const tenantId = tenant();
      const record = await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "party",
        action: "create",
        payload: {},
        clientGeneratedId: generateClientId(),
        createdById: "user-1",
      });
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await markMutationSynced(record.id, oneHourAgo);

      const purged = await purgeSyncedMutations(tenantId, 7 * ONE_DAY_MS);

      expect(purged).toBe(0);
      expect(await getMutation(record.id)).toBeDefined();
    });

    it("ne touche jamais une mutation non synchronisée, même en erreur", async () => {
      const tenantId = tenant();
      const pending = await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "party",
        action: "create",
        payload: {},
        clientGeneratedId: generateClientId(),
        createdById: "user-1",
      });
      const failed = await enqueueMutation({
        id: generateClientId(),
        tenantId,
        entity: "party",
        action: "create",
        payload: {},
        clientGeneratedId: generateClientId(),
        createdById: "user-1",
      });
      await markMutationFailed(failed.id, "Network error");

      // Rétention à 0 : n'importe quelle mutation synced serait purgée
      // immédiatement, mais ni pending ni failed ne sont synced.
      const purged = await purgeSyncedMutations(tenantId, 0);

      expect(purged).toBe(0);
      expect(await getMutation(pending.id)).toBeDefined();
      expect(await getMutation(failed.id)).toBeDefined();
    });

    it("isole la purge par tenant", async () => {
      const tenantA = tenant();
      const tenantB = tenant();
      const recordA = await enqueueMutation({
        id: generateClientId(),
        tenantId: tenantA,
        entity: "party",
        action: "create",
        payload: {},
        clientGeneratedId: generateClientId(),
        createdById: "user-1",
      });
      const eightDaysAgo = new Date(Date.now() - 8 * ONE_DAY_MS).toISOString();
      await markMutationSynced(recordA.id, eightDaysAgo);

      const purged = await purgeSyncedMutations(tenantB, 7 * ONE_DAY_MS);

      expect(purged).toBe(0);
      expect(await getMutation(recordA.id)).toBeDefined();
    });
  });
});
