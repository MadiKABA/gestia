import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { pullEntity, type PullTransport } from "@/infrastructure/offline/pull-engine";
import { AuthRequiredError } from "@/infrastructure/offline/errors";
import { getCursor } from "@/infrastructure/offline/sync-cursor.store";
import { getCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { enqueueMutation } from "@/infrastructure/offline/mutation-queue.store";
import { generateClientId } from "@/infrastructure/offline/id-generator";

function tenant() {
  return generateClientId();
}

describe("pullEntity", () => {
  it("premier pull (aucun curseur) : fusionne tout et pose le curseur", async () => {
    const tenantId = tenant();
    const id = generateClientId();
    const transport: PullTransport = async ({ since }) => {
      expect(new Date(since).getTime()).toBe(0); // epoch tant qu'aucun curseur n'existe
      return {
        ok: true,
        data: {
          records: [
            { id, updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null, data: { name: "A" } },
          ],
          serverTimestamp: "2026-01-02T00:00:00.000Z",
        },
      };
    };

    const result = await pullEntity({ tenantId, entity: "party", pullTransport: transport });

    expect(result).toEqual({ applied: 1, skipped: 0 });
    const cached = await getCachedEntity(tenantId, "party", id);
    expect(cached?.data).toEqual({ name: "A" });
    expect((await getCursor(tenantId, "party"))?.lastSyncedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("retire du cache local une entité soft-deletée côté serveur", async () => {
    const tenantId = tenant();
    const id = generateClientId();
    const transport: PullTransport = async () => ({
      ok: true,
      data: {
        records: [
          {
            id,
            updatedAt: "2026-01-01T00:00:00.000Z",
            deletedAt: "2026-01-01T00:00:00.000Z",
            data: {},
          },
        ],
        serverTimestamp: "2026-01-02T00:00:00.000Z",
      },
    });
    // Pré-remplit le cache pour vérifier qu'il est bien vidé.
    await pullEntity({
      tenantId,
      entity: "party",
      pullTransport: async () => ({
        ok: true,
        data: {
          records: [
            { id, updatedAt: "2025-01-01T00:00:00.000Z", deletedAt: null, data: { name: "A" } },
          ],
          serverTimestamp: "2025-01-02T00:00:00.000Z",
        },
      }),
    });
    expect(await getCachedEntity(tenantId, "party", id)).not.toBeUndefined();

    await pullEntity({ tenantId, entity: "party", pullTransport: transport });

    expect(await getCachedEntity(tenantId, "party", id)).toBeUndefined();
  });

  it("saute une entité ayant une mutation locale en attente (jamais écraser une édition pas encore poussée)", async () => {
    const tenantId = tenant();
    const clientGeneratedId = generateClientId();
    await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "update",
      payload: { name: "Édition locale" },
      clientGeneratedId,
      createdById: "user-1",
    });

    const transport: PullTransport = async () => ({
      ok: true,
      data: {
        records: [
          {
            id: clientGeneratedId,
            updatedAt: "2026-01-01T00:00:00.000Z",
            deletedAt: null,
            data: { name: "Valeur serveur" },
          },
        ],
        serverTimestamp: "2026-01-02T00:00:00.000Z",
      },
    });

    const result = await pullEntity({ tenantId, entity: "party", pullTransport: transport });

    expect(result).toEqual({ applied: 0, skipped: 1 });
    expect(await getCachedEntity(tenantId, "party", clientGeneratedId)).toBeUndefined();
  });

  it("pagine jusqu'à épuisement de nextPageCursor puis pose le curseur sur le dernier serverTimestamp", async () => {
    const tenantId = tenant();
    const calls: (string | undefined)[] = [];
    const transport: PullTransport = async ({ pageCursor }) => {
      calls.push(pageCursor);
      if (!pageCursor) {
        return {
          ok: true,
          data: {
            records: [
              { id: "a", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null, data: {} },
            ],
            nextPageCursor: "page-2",
            serverTimestamp: "2026-01-05T00:00:00.000Z",
          },
        };
      }
      return {
        ok: true,
        data: {
          records: [{ id: "b", updatedAt: "2026-01-02T00:00:00.000Z", deletedAt: null, data: {} }],
          serverTimestamp: "2026-01-06T00:00:00.000Z",
        },
      };
    };

    const result = await pullEntity({ tenantId, entity: "party", pullTransport: transport });

    expect(calls).toEqual([undefined, "page-2"]);
    expect(result).toEqual({ applied: 2, skipped: 0 });
    expect((await getCursor(tenantId, "party"))?.lastSyncedAt).toBe("2026-01-06T00:00:00.000Z");
  });

  it("n'avance pas le curseur si une page échoue en cours de pagination", async () => {
    const tenantId = tenant();
    const transport: PullTransport = async ({ pageCursor }) => {
      if (!pageCursor) {
        return {
          ok: true,
          data: {
            records: [
              { id: "a", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null, data: {} },
            ],
            nextPageCursor: "page-2",
            serverTimestamp: "2026-01-05T00:00:00.000Z",
          },
        };
      }
      throw new Error("Erreur réseau sur la page 2");
    };

    await expect(
      pullEntity({ tenantId, entity: "party", pullTransport: transport }),
    ).rejects.toThrow("Erreur réseau sur la page 2");

    expect(await getCursor(tenantId, "party")).toBeUndefined();
  });

  it("isole les curseurs et le cache par tenant", async () => {
    const tenantA = tenant();
    const tenantB = tenant();
    const transport: PullTransport = async () => ({
      ok: true,
      data: {
        records: [
          { id: "a", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null, data: { name: "A" } },
        ],
        serverTimestamp: "2026-01-02T00:00:00.000Z",
      },
    });

    await pullEntity({ tenantId: tenantA, entity: "party", pullTransport: transport });

    expect(await getCursor(tenantB, "party")).toBeUndefined();
    expect(await getCachedEntity(tenantB, "party", "a")).toBeUndefined();
  });

  it("session expirée (ok:false) : lève AuthRequiredError, curseur non avancé", async () => {
    const tenantId = tenant();
    const transport: PullTransport = async () => ({ ok: false, reason: "auth_required" });

    await expect(
      pullEntity({ tenantId, entity: "party", pullTransport: transport }),
    ).rejects.toBeInstanceOf(AuthRequiredError);

    expect(await getCursor(tenantId, "party")).toBeUndefined();
  });
});
