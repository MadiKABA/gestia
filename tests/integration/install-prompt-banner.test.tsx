import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { pwaLabels } from "@/presentation/shared/labels";

const SESSION_DISMISS_KEY = "gestia:install-prompt-dismissed";

const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Mobile Safari/537.36";
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function stubMatchMedia(standaloneMatches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: standaloneMatches,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function stubUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function stubIosStandaloneProperty(value: boolean | undefined) {
  Object.defineProperty(window.navigator, "standalone", { value, configurable: true });
}

function makeBeforeInstallPromptEvent(prompt = vi.fn().mockResolvedValue(undefined)) {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome: "accepted" as const });
  return event;
}

/**
 * Le module a un état singleton au niveau module (snapshot/listeners/
 * trackingInitialized, voir install-prompt-banner.tsx) — vi.resetModules()
 * + réimport dynamique dans chaque test simule un "premier chargement de
 * page" indépendant, condition nécessaire pour tester la détection
 * standalone/iOS qui ne s'exécute qu'une fois par cycle de vie du module.
 */
beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  localStorage.clear();
  stubMatchMedia(false);
  stubUserAgent(ANDROID_CHROME_UA);
  stubIosStandaloneProperty(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InstallPromptBanner", () => {
  it("ne s'affiche jamais en mode standalone (déjà installée)", async () => {
    stubMatchMedia(true);
    const { InstallPromptBanner } =
      await import("@/presentation/shared/components/install-prompt-banner");
    const { container } = render(<InstallPromptBanner />);

    fireEvent(window, makeBeforeInstallPromptEvent());

    expect(container).toBeEmptyDOMElement();
  });

  it("capture beforeinstallprompt et propose le bouton d'installation natif (Android/Chrome)", async () => {
    const { InstallPromptBanner } =
      await import("@/presentation/shared/components/install-prompt-banner");
    render(<InstallPromptBanner />);
    expect(screen.queryByText(pwaLabels.installTitle)).not.toBeInTheDocument();

    const prompt = vi.fn().mockResolvedValue(undefined);
    fireEvent(window, makeBeforeInstallPromptEvent(prompt));

    expect(screen.getByText(pwaLabels.installTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: pwaLabels.installButton }));
    expect(prompt).toHaveBeenCalledOnce();
  });

  it("sur iOS Safari (jamais de beforeinstallprompt), affiche les instructions manuelles sans bouton natif", async () => {
    stubUserAgent(IOS_SAFARI_UA);
    const { InstallPromptBanner } =
      await import("@/presentation/shared/components/install-prompt-banner");
    render(<InstallPromptBanner />);

    expect(screen.getByText(pwaLabels.installTitle)).toBeInTheDocument();
    expect(screen.getByText(pwaLabels.iosInstructions)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: pwaLabels.installButton })).not.toBeInTheDocument();
  });

  it("mémorise la fermeture en sessionStorage (pas localStorage) : ne réapparaît pas après un rechargement dans la même session", async () => {
    const { InstallPromptBanner } =
      await import("@/presentation/shared/components/install-prompt-banner");
    render(<InstallPromptBanner />);
    fireEvent(window, makeBeforeInstallPromptEvent());
    expect(screen.getByText(pwaLabels.installTitle)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: pwaLabels.dismissAria }));

    expect(screen.queryByText(pwaLabels.installTitle)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(SESSION_DISMISS_KEY)).toBe("1");
    expect(localStorage.getItem(SESSION_DISMISS_KEY)).toBeNull();

    // "Rechargement" : nouvelle instance du module (sessionStorage survit,
    // contrairement à l'état en mémoire précédent).
    vi.resetModules();
    const { InstallPromptBanner: ReloadedBanner } =
      await import("@/presentation/shared/components/install-prompt-banner");
    render(<ReloadedBanner />);
    fireEvent(window, makeBeforeInstallPromptEvent());

    expect(screen.queryByText(pwaLabels.installTitle)).not.toBeInTheDocument();
  });
});
