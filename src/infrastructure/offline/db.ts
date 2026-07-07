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
}

const DB_NAME = "gestia-offline";
const DB_VERSION = 1;

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
      upgrade(db) {
        db.createObjectStore("mutationQueue", { keyPath: "id" });
        const localCache = db.createObjectStore("localCache", { keyPath: "key" });
        localCache.createIndex("by-entity", ["tenantId", "entity"]);
      },
    });
  }
  return dbPromise;
}

/** Réservé aux tests : force la réouverture d'une base fraîche. */
export function resetDbConnection(): void {
  dbPromise = null;
}

export function localCacheKey(tenantId: string, entity: string, entityId: string): string {
  return `${tenantId}:${entity}:${entityId}`;
}
