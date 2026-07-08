import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAccountCache,
  ensureCacheMatchesAccount,
} from "@/infrastructure/offline/account-guard";
import { setCachedEntity, getCachedEntity } from "@/infrastructure/offline/local-cache.store";

beforeEach(() => {
  localStorage.clear();
});

describe("ensureCacheMatchesAccount", () => {
  it("premier appel (aucun marqueur) : ne vide rien, pose le marqueur", async () => {
    await setCachedEntity("tenant-1", "party", "a", { name: "A" }, "2026-01-01T00:00:00.000Z");

    await ensureCacheMatchesAccount("tenant-1", "user-1");

    expect(await getCachedEntity("tenant-1", "party", "a")).not.toBeUndefined();
    expect(localStorage.getItem("gestia:offline:last-account")).toBe("tenant-1:user-1");
  });

  it("même compte qu'au dernier appel : ne vide pas le cache", async () => {
    await ensureCacheMatchesAccount("tenant-1", "user-1");
    await setCachedEntity("tenant-1", "party", "a", { name: "A" }, "2026-01-01T00:00:00.000Z");

    await ensureCacheMatchesAccount("tenant-1", "user-1");

    expect(await getCachedEntity("tenant-1", "party", "a")).not.toBeUndefined();
  });

  it("compte différent (autre tenant ou autre utilisateur) : vide tout le cache", async () => {
    await ensureCacheMatchesAccount("tenant-1", "user-1");
    await setCachedEntity("tenant-1", "party", "a", { name: "A" }, "2026-01-01T00:00:00.000Z");

    await ensureCacheMatchesAccount("tenant-2", "user-2");

    expect(await getCachedEntity("tenant-1", "party", "a")).toBeUndefined();
    expect(localStorage.getItem("gestia:offline:last-account")).toBe("tenant-2:user-2");
  });

  it("même tenant mais utilisateur différent (autre vendeur) : vide aussi", async () => {
    await ensureCacheMatchesAccount("tenant-1", "user-1");
    await setCachedEntity("tenant-1", "party", "a", { name: "A" }, "2026-01-01T00:00:00.000Z");

    await ensureCacheMatchesAccount("tenant-1", "user-2");

    expect(await getCachedEntity("tenant-1", "party", "a")).toBeUndefined();
  });
});

describe("clearAccountCache", () => {
  it("vide le cache et retire le marqueur de compte", async () => {
    await ensureCacheMatchesAccount("tenant-1", "user-1");
    await setCachedEntity("tenant-1", "party", "a", { name: "A" }, "2026-01-01T00:00:00.000Z");

    await clearAccountCache();

    expect(await getCachedEntity("tenant-1", "party", "a")).toBeUndefined();
    expect(localStorage.getItem("gestia:offline:last-account")).toBeNull();
  });

  it("après clearAccountCache, une reconnexion de n'importe quel compte est traitée comme la première fois", async () => {
    await ensureCacheMatchesAccount("tenant-1", "user-1");
    await clearAccountCache();
    await setCachedEntity("tenant-1", "party", "a", { name: "A" }, "2026-01-01T00:00:00.000Z");

    // Même tenant/user qu'avant déconnexion, mais le marqueur a été retiré :
    // ne doit pas vider ce qui vient d'être réécrit après clearAccountCache.
    await ensureCacheMatchesAccount("tenant-1", "user-1");

    expect(await getCachedEntity("tenant-1", "party", "a")).not.toBeUndefined();
  });
});
