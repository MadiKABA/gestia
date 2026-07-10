import { getDb, type MutationQueueRecord } from "@/infrastructure/offline/db";
import { removeCachedEntity } from "@/infrastructure/offline/local-cache.store";

export type NewMutationQueueEntry = Pick<
  MutationQueueRecord,
  | "id"
  | "tenantId"
  | "entity"
  | "action"
  | "payload"
  | "clientGeneratedId"
  | "createdById"
  | "clientKnownUpdatedAt"
>;

/**
 * CRUD de la queue de mutations (IndexedDB, store `mutationQueue`). Ne
 * supprime une entrée qu'après confirmation serveur explicite ET expiration
 * de la rétention de debug (voir `purgeSyncedMutations` plus bas) — jamais
 * de suppression directe d'une mutation non confirmée ou en erreur.
 */
export async function enqueueMutation(entry: NewMutationQueueEntry): Promise<MutationQueueRecord> {
  const db = await getDb();
  const record: MutationQueueRecord = {
    ...entry,
    createdAt: new Date().toISOString(),
    synced: false,
    retryCount: 0,
  };
  await db.put("mutationQueue", record);
  return record;
}

/**
 * Mutations non synchronisées, dans l'ordre chronologique de création —
 * exclut les échecs définitifs (`permanentlyFailed: true`, voir
 * `markMutationPermanentlyFailed`) : celles-ci ne sont plus jamais
 * retentées automatiquement, seulement listées via `listFailedMutations`
 * pour résolution manuelle.
 */
export async function listPendingMutations(tenantId: string): Promise<MutationQueueRecord[]> {
  const db = await getDb();
  const all = await db.getAll("mutationQueue");
  return all
    .filter((m) => m.tenantId === tenantId && !m.synced && !m.permanentlyFailed)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function markMutationSynced(id: string, syncedAt: string): Promise<void> {
  const db = await getDb();
  const record = await db.get("mutationQueue", id);
  if (!record) return;
  await db.put("mutationQueue", { ...record, synced: true, syncedAt, syncError: undefined });
}

export async function markMutationFailed(
  id: string,
  error: string,
): Promise<MutationQueueRecord | undefined> {
  const db = await getDb();
  const record = await db.get("mutationQueue", id);
  if (!record) return undefined;
  const updated: MutationQueueRecord = {
    ...record,
    syncError: error,
    retryCount: record.retryCount + 1,
  };
  await db.put("mutationQueue", updated);
  return updated;
}

export async function getMutation(id: string): Promise<MutationQueueRecord | undefined> {
  const db = await getDb();
  return db.get("mutationQueue", id);
}

/**
 * Marque une mutation comme échec définitif (erreur de validation métier —
 * voir sync-engine.ts, qui distingue ce cas d'un échec transitoire) :
 * `retryCount` n'est volontairement pas incrémenté, ce n'est plus un compteur
 * pertinent pour une mutation qui ne sera plus jamais retentée
 * automatiquement. Reste en base (jamais supprimée ici) pour résolution
 * manuelle via `listFailedMutations`/`discardMutation`.
 */
export async function markMutationPermanentlyFailed(
  id: string,
  error: string,
): Promise<MutationQueueRecord | undefined> {
  const db = await getDb();
  const record = await db.get("mutationQueue", id);
  if (!record) return undefined;
  const updated: MutationQueueRecord = { ...record, syncError: error, permanentlyFailed: true };
  await db.put("mutationQueue", updated);
  return updated;
}

/** Mutations en échec définitif d'un tenant — source de l'interface de
 * résolution (presentation/offline/components/sync-failures-panel.tsx). */
export async function listFailedMutations(tenantId: string): Promise<MutationQueueRecord[]> {
  const db = await getDb();
  const all = await db.getAll("mutationQueue");
  return all
    .filter((m) => m.tenantId === tenantId && m.permanentlyFailed)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * "Ignorer cette action" (interface de résolution) : retire définitivement
 * une mutation en échec de la queue. Pour un `create`, l'entité fantôme
 * correspondante n'a jamais existé côté serveur — aucun pull ne la
 * nettoiera jamais de lui-même (il n'y a rien à réconcilier), donc son
 * entrée de cache local est retirée ici explicitement. Pour un
 * `update`/`delete` abandonné, le cache local garde l'édition optimiste
 * jusqu'au prochain pull, qui la corrigera avec la vraie valeur serveur
 * (plus aucune mutation en attente ne le bloque une fois cette ligne
 * supprimée) — l'appelant doit donc déclencher une synchronisation après
 * cet appel (voir triggerBackgroundSync).
 */
export async function discardMutation(id: string): Promise<void> {
  const db = await getDb();
  const record = await db.get("mutationQueue", id);
  if (!record) return;
  if (record.action === "create") {
    await removeCachedEntity(record.tenantId, record.entity, record.clientGeneratedId);
  }
  await db.delete("mutationQueue", id);
}

/**
 * Vrai si une entité a une mutation locale pas encore synchronisée — utilisé
 * par pull-engine.ts pour ne jamais écraser une édition optimiste pas encore
 * poussée avec une valeur serveur plus ancienne du point de vue de
 * l'utilisateur (elle sera correctement réconciliée quand cette mutation
 * finira par pousser, via le mécanisme de conflit déjà en place côté push).
 */
export async function hasPendingMutationFor(
  tenantId: string,
  entity: string,
  clientGeneratedId: string,
): Promise<boolean> {
  const pending = await listPendingMutations(tenantId);
  return pending.some((m) => m.entity === entity && m.clientGeneratedId === clientGeneratedId);
}

/**
 * Tenants ayant au moins une mutation en attente — utilisé par le service
 * worker (voir src/app/sw.ts) lors d'un événement `sync` : il n'a pas accès
 * au contexte de la page (donc pas de tenantId "courant" injecté), mais peut
 * lire IndexedDB directement. En pratique un seul tenant est présent à la
 * fois (account-guard.ts vide le cache à tout changement de compte), mais
 * cette fonction reste correcte même transitoirement.
 */
export async function listPendingTenantIds(): Promise<string[]> {
  const db = await getDb();
  const all = await db.getAll("mutationQueue");
  return [...new Set(all.filter((m) => !m.synced).map((m) => m.tenantId))];
}

/** Rétention de debug par défaut pour une mutation déjà synchronisée — assez
 * pour investiguer un incident de sync récent sans laisser la file croître
 * indéfiniment (cf. ARCHITECTURE.md). */
export const SYNCED_MUTATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Supprime les mutations `synced: true` dont `syncedAt` dépasse la
 * rétention donnée — jamais une mutation non confirmée (`synced: false`,
 * qu'elle soit en attente ou en erreur `syncError`) : celles-ci doivent
 * rester visibles pour debug/retry, purger ne concerne que la queue déjà
 * confirmée côté serveur. Appelée à la fin de chaque cycle push+pull réussi
 * (voir `network-status-store.ts:runSync`), jamais sur un cycle en échec.
 */
export async function purgeSyncedMutations(
  tenantId: string,
  retentionMs: number = SYNCED_MUTATION_RETENTION_MS,
): Promise<number> {
  const db = await getDb();
  const all = await db.getAll("mutationQueue");
  const cutoff = Date.now() - retentionMs;
  const expired = all.filter(
    (m) =>
      m.tenantId === tenantId &&
      m.synced &&
      m.syncedAt !== undefined &&
      Date.parse(m.syncedAt) < cutoff,
  );
  await Promise.all(expired.map((m) => db.delete("mutationQueue", m.id)));
  return expired.length;
}
