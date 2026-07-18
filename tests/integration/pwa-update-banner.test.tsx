import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PwaUpdateBanner } from "@/presentation/shared/components/pwa-update-banner";
import { pwaLabels } from "@/presentation/shared/labels";

/**
 * Couvre le cycle de mise à jour du service worker sans désinstallation
 * (cf. CLAUDE.md/sw.ts) : un nouveau service worker "waiting" doit afficher
 * la bannière, jamais activer silencieusement — l'utilisateur confirme via
 * `messageSkipWaiting()`, le rechargement suit l'événement "controlling"
 * (déclenché par le navigateur une fois le nouveau service worker actif),
 * jamais un minuteur arbitraire. `useSerwist` mocké avec un faux
 * `EventTarget`-like minimal (mêmes méthodes que `SerwistEventTarget`), pas
 * de vrai service worker en jsdom.
 */
type Listener = (event: unknown) => void;

function makeFakeSerwist() {
  const listeners = new Map<string, Set<Listener>>();
  const messageSkipWaiting = vi.fn();
  return {
    messageSkipWaiting,
    addEventListener: (type: string, listener: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    },
    emit: (type: string) => {
      for (const listener of listeners.get(type) ?? []) listener({});
    },
  };
}

let fakeSerwist: ReturnType<typeof makeFakeSerwist>;

vi.mock("@serwist/turbopack/react", () => ({
  useSerwist: () => ({ serwist: fakeSerwist }),
}));

beforeEach(() => {
  fakeSerwist = makeFakeSerwist();
});

describe("PwaUpdateBanner — mise à jour du service worker sans désinstallation", () => {
  it("reste invisible tant qu'aucun service worker n'est en attente", () => {
    render(<PwaUpdateBanner />);
    expect(screen.queryByText(pwaLabels.updateAvailableTitle)).not.toBeInTheDocument();
  });

  it('affiche la bannière quand un service worker passe en attente ("waiting")', () => {
    render(<PwaUpdateBanner />);
    act(() => fakeSerwist.emit("waiting"));
    expect(screen.getByText(pwaLabels.updateAvailableTitle)).toBeInTheDocument();
  });

  it("envoie SKIP_WAITING au clic, jamais avant — pas de bascule silencieuse", async () => {
    const user = userEvent.setup();
    render(<PwaUpdateBanner />);
    act(() => fakeSerwist.emit("waiting"));

    expect(fakeSerwist.messageSkipWaiting).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: pwaLabels.updateButton }));
    expect(fakeSerwist.messageSkipWaiting).toHaveBeenCalledOnce();
  });

  it('recharge la page seulement une fois le nouveau service worker devenu contrôleur ("controlling")', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    const user = userEvent.setup();
    render(<PwaUpdateBanner />);
    act(() => fakeSerwist.emit("waiting"));
    await user.click(screen.getByRole("button", { name: pwaLabels.updateButton }));

    expect(reloadMock).not.toHaveBeenCalled();
    act(() => fakeSerwist.emit("controlling"));
    expect(reloadMock).toHaveBeenCalledOnce();

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });
});
