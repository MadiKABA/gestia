import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * Enregistrement persisté de la queue de mutations — écrit une fois par
 * mutation locale, jamais supprimé avant confirmation serveur explicite
 * (cahier des charges §9 : aucune transaction offline perdue).
 */
export type MutationQueueRecord = {
  id: string;
  tenantId: string;
  entity: string;
  action: "create" | "update" | "delete";
  payload: unknown;
  clientGeneratedId: string;
  /**
   * Figé à l'enfilement uniquement pour `delete` (dont le cache local est
   * retiré immédiatement, avant que le moteur de sync ait pu le relire) —
   * `update` continue de le relire depuis le cache au moment de l'envoi
   * (voir sync-engine.ts) puisque son entrée de cache existe toujours.
   */
  clientKnownUpdatedAt?: string;
  createdAt: string;
  createdById: string;
  synced: boolean;
  syncedAt?: string;
  syncError?: string;
  retryCount: number;
};

/** Cache local générique — affichage instantané même hors ligne. */
export type LocalCacheRecord<TData = unknown> = {
  key: string;
  tenantId: string;
  entity: string;
  entityId: string;
  data: TData;
  updatedAt: string;
};

/**
 * Curseur de synchronisation descendante — un par couple tenant/entity.
 * `lastSyncedAt` n'avance qu'après confirmation qu'un pull complet (toutes
 * les pages) a réussi, jamais en cas d'échec partiel (voir pull-engine.ts) :
 * une valeur en retard ne fait que refaire relire des enregistrements déjà à
 * jour (fusion idempotente), alors qu'une valeur trop avancée ferait manquer
 * des changements serveur définitivement.
 */
export type SyncCursorRecord = {
  key: string;
  tenantId: string;
  entity: string;
  lastSyncedAt: string;
};

interface GestiaOfflineDB extends DBSchema {
  mutationQueue: {
    key: string;
    value: MutationQueueRecord;
  };
  localCache: {
    key: string;
    value: LocalCacheRecord;
    indexes: { "by-entity": [string, string] };
  };
  syncCursors: {
    key: string;
    value: SyncCursorRecord;
  };
}

const DB_NAME = "gestia-offline";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<GestiaOfflineDB>> | null = null;

/**
 * Singleton lazy — n'ouvre la base qu'au premier appel, jamais au chargement
 * du module (ce fichier ne doit s'exécuter que côté navigateur : `idb`
 * échoue explicitement si `indexedDB` est absent, ce qui est le comportement
 * voulu si un appelant l'importe par erreur côté serveur).
 */
export function getDb(): Promise<IDBPDatabase<GestiaOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GestiaOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("mutationQueue", { keyPath: "id" });
          const localCache = db.createObjectStore("localCache", { keyPath: "key" });
          localCache.createIndex("by-entity", ["tenantId", "entity"]);
        }
        if (oldVersion < 2) {
          db.createObjectStore("syncCursors", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/** Réservé aux tests : force la réouverture d'une base fraîche. */
export function resetDbConnection(): void {
  dbPromise = null;
}

/**
 * Vide entièrement le cache offline — déconnexion ou changement de
 * compte/tenant sur le même appareil (voir account-guard.ts). Les données
 * en cache local contiennent des informations métier sensibles (montants,
 * coordonnées clients) sur un appareil potentiellement partagé ou volé,
 * jamais chiffrées au repos dans IndexedDB (voir ARCHITECTURE.md "Sécurité
 * du cache local") : ce vidage systématique est la seule protection réelle
 * de cette version. `clear()` sur chaque store plutôt qu'un `deleteDB` :
 * évite de fermer/rouvrir la connexion IndexedDB déjà ouverte par cet
 * onglet, source de blocages silencieux si un autre appel est en cours.
 */
export async function clearAllOfflineData(): Promise<void> {
  const db = await getDb();
  await Promise.all([db.clear("mutationQueue"), db.clear("localCache"), db.clear("syncCursors")]);
}

export function localCacheKey(tenantId: string, entity: string, entityId: string): string {
  return `${tenantId}:${entity}:${entityId}`;
}
