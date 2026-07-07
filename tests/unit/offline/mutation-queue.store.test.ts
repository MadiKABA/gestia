import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  enqueueMutation,
  hasPendingMutationFor,
  listPendingMutations,
  markMutationFailed,
  markMutationSynced,
} from "@/infrastructure/offline/mutation-queue.store";
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
});
