/**
 * L'API Background Sync (SyncEvent, ServiceWorkerRegistration.sync,
 * SyncManager) n'est pas dans lib.webworker.d.ts/lib.dom.d.ts (encore non
 * standard) — déclarée manuellement ici, minimale, juste ce que le projet
 * utilise. Fichier dédié plutôt que noyée dans src/app/sw.ts : ces types
 * sont consommés à la fois côté service worker (sw.ts, écouteur `sync`) et
 * côté page (network-status-store.ts, `registration.sync.register(...)`),
 * une déclaration globale dans l'un ou l'autre serait un effet de bord
 * accidentel plutôt qu'une dépendance explicite.
 */

interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

interface ServiceWorkerRegistration {
  readonly sync: SyncManager;
}

interface ServiceWorkerGlobalScopeEventMap {
  sync: SyncEvent;
}
