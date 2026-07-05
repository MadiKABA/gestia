/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import { Serwist } from "serwist";
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
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
