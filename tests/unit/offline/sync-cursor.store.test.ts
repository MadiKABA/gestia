import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { getCursor, setCursor } from "@/infrastructure/offline/sync-cursor.store";
import { generateClientId } from "@/infrastructure/offline/id-generator";

function tenant() {
  return generateClientId();
}

describe("sync-cursor.store", () => {
  it("aucun curseur avant le premier pull réussi", async () => {
    const tenantId = tenant();
    expect(await getCursor(tenantId, "party")).toBeUndefined();
  });

  it("écrit puis relit le curseur d'un couple tenant/entity", async () => {
    const tenantId = tenant();
    await setCursor(tenantId, "party", "2026-01-01T00:00:00.000Z");

    const cursor = await getCursor(tenantId, "party");
    expect(cursor?.lastSyncedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("un setCursor ultérieur remplace la valeur précédente sans dupliquer l'entrée", async () => {
    const tenantId = tenant();
    await setCursor(tenantId, "party", "2026-01-01T00:00:00.000Z");
    await setCursor(tenantId, "party", "2026-01-02T00:00:00.000Z");

    const cursor = await getCursor(tenantId, "party");
    expect(cursor?.lastSyncedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("isole les curseurs par entity pour un même tenant", async () => {
    const tenantId = tenant();
    await setCursor(tenantId, "party", "2026-01-01T00:00:00.000Z");

    expect(await getCursor(tenantId, "transaction")).toBeUndefined();
  });

  it("isole les curseurs par tenant pour une même entity", async () => {
    const tenantA = tenant();
    const tenantB = tenant();
    await setCursor(tenantA, "party", "2026-01-01T00:00:00.000Z");

    expect(await getCursor(tenantB, "party")).toBeUndefined();
  });
});
