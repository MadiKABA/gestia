import { getDb, type MutationQueueRecord } from "@/infrastructure/offline/db";

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
 * supprime jamais une entrée avant confirmation serveur explicite — voir
 * `markSynced`, jamais de `delete` direct exposé ici.
 *
 * TODO: les entrées `synced: true` ne sont jamais purgées après coup —
 * `markMutationSynced` ne fait que les marquer, la queue ne fait donc que
 * grandir sur la durée de vie d'un appareil. Pas critique pour le volume
 * d'usage V1 (voir CLAUDE.md), mais à traiter avant que ça devienne
 * perceptible (purge périodique des entrées synced anciennes, par exemple).
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

/** Mutations non synchronisées, dans l'ordre chronologique de création. */
export async function listPendingMutations(tenantId: string): Promise<MutationQueueRecord[]> {
  const db = await getDb();
  const all = await db.getAll("mutationQueue");
  return all
    .filter((m) => m.tenantId === tenantId && !m.synced)
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
