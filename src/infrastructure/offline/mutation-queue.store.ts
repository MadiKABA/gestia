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
