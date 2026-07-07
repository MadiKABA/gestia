import { afterEach, describe, expect, it, vi } from "vitest";
import { isIosSafari, supportsBackgroundSync } from "@/infrastructure/offline/platform";

function setUserAgent(ua: string, platform = "") {
  vi.stubGlobal("navigator", { userAgent: ua, platform, maxTouchPoints: 0 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isIosSafari", () => {
  it("vrai sur iPhone Safari", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    expect(isIosSafari()).toBe(true);
  });

  it("vrai sur iPad en mode desktop (MacIntel + points tactiles)", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    });
    expect(isIosSafari()).toBe(true);
  });

  it("faux sur Chrome iOS (WebKit mais pas Safari)", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0 Mobile/15E148 Safari/604.1",
    );
    expect(isIosSafari()).toBe(false);
  });

  it("faux sur Android Chrome", () => {
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Mobile Safari/537.36",
    );
    expect(isIosSafari()).toBe(false);
  });

  it("faux sur desktop Mac (pas de points tactiles)", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "MacIntel",
    );
    expect(isIosSafari()).toBe(false);
  });
});

describe("supportsBackgroundSync", () => {
  it("vrai quand SyncManager et serviceWorker sont exposés (Android/Chrome)", () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("window", { SyncManager: class {} });
    expect(supportsBackgroundSync()).toBe(true);
  });

  it("faux sur iOS (SyncManager jamais exposé, quel que soit le navigateur)", () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("window", {});
    expect(supportsBackgroundSync()).toBe(false);
  });

  it("faux si serviceWorker lui-même n'est pas supporté", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { SyncManager: class {} });
    expect(supportsBackgroundSync()).toBe(false);
  });
});
