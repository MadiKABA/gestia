import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isStoragePersisted,
  requestPersistentStorage,
} from "@/infrastructure/offline/storage-persistence";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPersistentStorage", () => {
  it("renvoie true quand le navigateur accorde la persistance", async () => {
    vi.stubGlobal("navigator", { storage: { persist: vi.fn().mockResolvedValue(true) } });
    expect(await requestPersistentStorage()).toBe(true);
  });

  it("renvoie false quand le navigateur refuse", async () => {
    vi.stubGlobal("navigator", { storage: { persist: vi.fn().mockResolvedValue(false) } });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it("renvoie false sans lancer d'erreur sur un navigateur sans API Storage", async () => {
    vi.stubGlobal("navigator", {});
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});

describe("isStoragePersisted", () => {
  it("relaie la valeur de navigator.storage.persisted()", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: vi.fn().mockResolvedValue(true) } });
    expect(await isStoragePersisted()).toBe(true);
  });

  it("renvoie false sans lancer d'erreur sur un navigateur sans API Storage", async () => {
    vi.stubGlobal("navigator", {});
    await expect(isStoragePersisted()).resolves.toBe(false);
  });
});
