/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import { NetworkFirst, Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * PWA offline complet (cahier des charges §7) : précache de l'app shell +
 * stratégies runtime par défaut. La queue de synchronisation métier
 * (transactions/paiements créés hors-ligne) vit dans
 * src/infrastructure/offline (IndexedDB), pas ici — ce fichier gère
 * uniquement le cache réseau/assets.
 *
 * Le fallback offline (`/offline.html`) est un fichier statique dans public/
 * plutôt qu'une page App Router : les pages App Router (RSC) ne sont pas
 * précachables telles quelles par Serwist (voir
 * https://github.com/serwist/serwist/discussions/174), un fichier HTML
 * autonome dans le précache évite ce problème. Déjà inclus automatiquement
 * dans `__SW_MANIFEST` (tout fichier de public/ y est) — ne pas le rajouter
 * manuellement, ça créerait une entrée dupliquée avec une révision en
 * conflit et ferait échouer l'évaluation du service worker.
 *
 * `defaultCache` matche les documents via des en-têtes de *requête*
 * (`Content-Type`, `RSC`) qu'une vraie navigation plein-page ne porte
 * jamais (`Content-Type` n'existe que sur les réponses/requêtes avec
 * corps) — vérifié en pratique : aucune de ses entrées ne matche une
 * navigation `mode: "navigate"`, donc `respondWith()` n'est jamais
 * appelé et le fallback ne se déclenche jamais. On enregistre donc une
 * route dédiée sur `request.mode === "navigate"` avant `defaultCache`
 * (premier match gagne) pour ne jamais rater une navigation réelle ; les
 * transitions client-side de Next.js (fetch RSC) ne passent pas par
 * `mode: "navigate"` et continuent d'utiliser les entrées RSC de
 * `defaultCache` normalement.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: "pages" }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
