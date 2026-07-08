import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { clearAllOfflineData } from "@/infrastructure/offline/db";
import {
  enqueueMutation,
  listPendingMutations,
} from "@/infrastructure/offline/mutation-queue.store";
import { getCachedEntity, setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { getCursor, setCursor } from "@/infrastructure/offline/sync-cursor.store";
import { generateClientId } from "@/infrastructure/offline/id-generator";

function tenant() {
  return generateClientId();
}

describe("clearAllOfflineData", () => {
  it("vide la queue de mutations, le cache local et les curseurs de sync", async () => {
    const tenantId = tenant();
    const entityId = generateClientId();
    await enqueueMutation({
      id: generateClientId(),
      tenantId,
      entity: "party",
      action: "create",
      payload: {},
      clientGeneratedId: entityId,
      createdById: "user-1",
    });
    await setCachedEntity(tenantId, "party", entityId, { name: "A" }, "2026-01-01T00:00:00.000Z");
    await setCursor(tenantId, "party", "2026-01-01T00:00:00.000Z");

    await clearAllOfflineData();

    expect(await listPendingMutations(tenantId)).toHaveLength(0);
    expect(await getCachedEntity(tenantId, "party", entityId)).toBeUndefined();
    expect(await getCursor(tenantId, "party")).toBeUndefined();
  });

  it("vide tous les tenants, pas seulement un tenant particulier (changement de compte)", async () => {
    const tenantA = tenant();
    const tenantB = tenant();
    await setCachedEntity(tenantA, "party", "a", { name: "A" }, "2026-01-01T00:00:00.000Z");
    await setCachedEntity(tenantB, "party", "b", { name: "B" }, "2026-01-01T00:00:00.000Z");

    await clearAllOfflineData();

    expect(await getCachedEntity(tenantA, "party", "a")).toBeUndefined();
    expect(await getCachedEntity(tenantB, "party", "b")).toBeUndefined();
  });
});
