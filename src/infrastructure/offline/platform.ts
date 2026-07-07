/** Tag partagé entre l'enregistrement côté page (network-status-store.ts) et
 * l'écouteur côté service worker (src/app/sw.ts) — Background Sync API. */
export const BACKGROUND_SYNC_TAG = "gestia-sync";

/**
 * Détection de plateforme pour les différences Android/iOS documentées dans
 * ARCHITECTURE.md ("Limitations iOS") — centralisée ici plutôt que dupliquée
 * (ex: install-prompt-banner.tsx utilisait sa propre copie privée de
 * `isIosSafari`).
 */
export function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIosDevice =
    /iphone|ipad|ipod/i.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafariBrowser = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  return isIosDevice && isSafariBrowser;
}

/**
 * Vrai si le navigateur expose l'API Background Sync (Android/Chrome et
 * dérivés Chromium) — jamais vrai sur iOS, quel que soit le navigateur
 * utilisé dessus : WebKit (imposé par Apple à tous les navigateurs iOS, y
 * compris Chrome/Firefox pour iOS) ne l'implémente pas. Détection par
 * capacité plutôt que par UA sniffing : couvre ce cas sans avoir besoin de
 * connaître chaque navigateur iOS existant.
 */
export function supportsBackgroundSync(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "SyncManager" in window;
}
