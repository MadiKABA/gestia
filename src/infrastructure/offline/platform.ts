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

/**
 * État réseau au moment précis de l'appel — jamais mis en cache, relu à
 * chaque fois (voir *-offline.repository.ts:create/update/delete, qui
 * doivent décider en ligne/hors ligne juste avant d'agir, pas au chargement
 * de la page). Les repositories offline-first qui l'appellent ne sont
 * jamais exécutés côté serveur en usage réel (composants "use client"
 * uniquement) — `navigator` y est donc toujours défini. Un `navigator`
 * absent (Node, tests d'intégration qui pilotent la queue explicitement
 * via `syncQueue` sans jamais passer par un vrai navigateur) est traité
 * comme hors ligne plutôt qu'en ligne : en l'absence de toute information
 * réseau fiable, l'hypothèse la plus sûre pour "aucune saisie perdue" est
 * de passer par le cache + la queue, jamais de tenter un appel réseau
 * halluciné.
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}
