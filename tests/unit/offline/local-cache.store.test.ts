import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  getCachedEntity,
  listCachedEntities,
  removeCachedEntity,
  setCachedEntity,
} from "@/infrastructure/offline/local-cache.store";
import { generateClientId } from "@/infrastructure/offline/id-generator";

function tenant() {
  return generateClientId();
}

describe("local-cache.store", () => {
  it("écrit puis relit une entité par id", async () => {
    const tenantId = tenant();
    const id = generateClientId();
    await setCachedEntity(tenantId, "party", id, { name: "Fatou Diop" }, "2026-01-01T00:00:00Z");

    const cached = await getCachedEntity<{ name: string }>(tenantId, "party", id);
    expect(cached?.data.name).toBe("Fatou Diop");
  });

  it("liste toutes les entités d'une entity pour un tenant", async () => {
    const tenantId = tenant();
    await setCachedEntity(
      tenantId,
      "party",
      generateClientId(),
      { name: "A" },
      "2026-01-01T00:00:00Z",
    );
    await setCachedEntity(
      tenantId,
      "party",
      generateClientId(),
      { name: "B" },
      "2026-01-01T00:00:00Z",
    );
    await setCachedEntity(
      tenantId,
      "transaction",
      generateClientId(),
      { amount: 100 },
      "2026-01-01T00:00:00Z",
    );

    const parties = await listCachedEntities<{ name: string }>(tenantId, "party");
    expect(parties).toHaveLength(2);
  });

  it("supprime une entité du cache", async () => {
    const tenantId = tenant();
    const id = generateClientId();
    await setCachedEntity(tenantId, "party", id, { name: "Fatou Diop" }, "2026-01-01T00:00:00Z");
    await removeCachedEntity(tenantId, "party", id);

    const cached = await getCachedEntity(tenantId, "party", id);
    expect(cached).toBeUndefined();
  });
});
