"use client";

import { useSyncExternalStore } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { pwaLabels } from "@/presentation/shared/labels";
import { isIosSafari } from "@/infrastructure/offline/platform";

const SESSION_DISMISS_KEY = "gestia:install-prompt-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallSnapshot = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  showIosInstructions: boolean;
  dismissed: boolean;
};

const SERVER_SNAPSHOT: InstallSnapshot = {
  deferredPrompt: null,
  showIosInstructions: false,
  dismissed: true,
};

function isStandaloneDisplay(): boolean {
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

/**
 * État exposé via un store externe (useSyncExternalStore) plutôt que
 * useState+useEffect : `getServerSnapshot` (bannière masquée) est utilisé
 * par React pendant le rendu serveur ET la passe d'hydratation, ce qui évite
 * tout mismatch — sessionStorage/matchMedia/beforeinstallprompt n'existent
 * pas côté serveur.
 */
let snapshot: InstallSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let trackingInitialized = false;

function publish(next: Partial<InstallSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function initInstallTracking() {
  if (trackingInitialized) return;
  trackingInitialized = true;

  if (isStandaloneDisplay()) return;

  publish({
    dismissed: sessionStorage.getItem(SESSION_DISMISS_KEY) === "1",
    showIosInstructions: isIosSafari(),
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    publish({ deferredPrompt: event as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => {
    publish({ deferredPrompt: null, showIosInstructions: false });
  });
}

function subscribe(listener: () => void) {
  initInstallTracking();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

/**
 * Invite d'installation automatique (cahier des charges PWA — installabilité
 * sans action de recherche de l'utilisateur). Ne s'affiche jamais en mode
 * standalone (déjà installée). Android/Chrome : capture `beforeinstallprompt`
 * et propose le prompt natif. iOS Safari ne déclenche jamais cet événement —
 * instructions manuelles à la place. Fermeture mémorisée en sessionStorage
 * (pas de rappel dans la même session, mais réaffichée à la prochaine visite
 * si toujours pas installée).
 */
export function InstallPromptBanner() {
  const { deferredPrompt, showIosInstructions, dismissed } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const visible = !dismissed && (deferredPrompt !== null || showIosInstructions);
  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    publish({ dismissed: true });
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    publish({ deferredPrompt: null });
  }

  return (
    <div className="bg-primary text-primary-foreground flex items-center gap-3 px-4 py-2.5 text-sm">
      <SquarePlus className="size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{pwaLabels.installTitle}</p>
        {deferredPrompt ? (
          <p className="text-primary-foreground/80 text-xs">{pwaLabels.installDescription}</p>
        ) : (
          <p className="text-primary-foreground/80 flex items-center gap-1 text-xs">
            <Share className="size-3 shrink-0" aria-hidden />
            {pwaLabels.iosInstructions}
          </p>
        )}
      </div>
      {deferredPrompt ? (
        <Button size="sm" variant="secondary" onClick={install}>
          {pwaLabels.installButton}
        </Button>
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        aria-label={pwaLabels.dismissAria}
        className="hover:bg-primary-foreground/10 shrink-0 rounded-md p-1"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
