/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import { NetworkFirst, Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { syncQueue } from "@/infrastructure/offline/sync-engine";
import { listPendingTenantIds } from "@/infrastructure/offline/mutation-queue.store";
import { BACKGROUND_SYNC_TAG } from "@/infrastructure/offline/platform";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncMutationResult } from "@/application/offline/sync-mutation.use-case";

// SyncEvent/ServiceWorkerRegistration.sync : voir src/types/background-sync.d.ts.

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
 * src/infrastructure/offline (IndexedDB) — ce fichier ne fait QUE le cache
 * réseau/assets, à une exception près : l'écouteur `sync` tout en bas, qui
 * réutilise directement `syncQueue` (déjà DOM-agnostique, seul son transport
 * change) pour drainer la queue de mutations même app fermée, quand le
 * navigateur le permet (Background Sync API — voir ARCHITECTURE.md
 * "Limitations iOS" pour les navigateurs qui ne le permettent jamais).
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

/**
 * Transport du push depuis le SW : fetch simple vers /api/sync (Route
 * Handler dédié), jamais la Server Action `syncMutationAction` — celle-ci
 * repose sur l'encodage RPC interne de Next.js, généré et consommé côté
 * navigateur en contexte page, pas exploitable de façon fiable ici.
 * `credentials: "include"` transmet le cookie de session (même origine) ;
 * requireTenantContext() le revalide côté serveur exactement comme pour une
 * Server Action.
 */
async function pushMutationFromServiceWorker(
  mutation: QueuedMutation,
): Promise<SyncMutationResult> {
  const response = await fetch("/api/sync", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "push", mutation }),
  });
  if (!response.ok) {
    throw new Error(`Échec de la synchronisation en arrière-plan (${response.status})`);
  }
  return response.json();
}

/**
 * Drainage best-effort de la queue au retour de connectivité, y compris app
 * fermée (Android/Chrome et dérivés Chromium uniquement — voir
 * ARCHITECTURE.md). Ne fait QUE le push : aucune entity n'est enregistrée
 * pour le pull dans ce contexte (pull-registry.ts vit côté page, jamais
 * chargé par ce bundle SW), et le pull reste moins urgent app fermée que la
 * garantie "aucune mutation locale perdue" que cet événement sert. Si
 * `syncQueue` rejette (échec réseau, session expirée...), la promesse
 * transmise à `event.waitUntil` rejette aussi : le navigateur replanifie
 * alors lui-même une nouvelle tentative selon sa propre politique de
 * backoff — jamais géré manuellement ici.
 */
self.addEventListener("sync", (event) => {
  if (event.tag !== BACKGROUND_SYNC_TAG) return;
  event.waitUntil(
    (async () => {
      for (const tenantId of await listPendingTenantIds()) {
        const result = await syncQueue({ tenantId, syncTransport: pushMutationFromServiceWorker });
        if (result.failed) {
          throw new Error("Synchronisation en arrière-plan incomplète, nouvelle tentative à venir");
        }
      }
    })(),
  );
});
