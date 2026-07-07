import { getDb, localCacheKey, type LocalCacheRecord } from "@/infrastructure/offline/db";

/** CRUD du cache local générique (IndexedDB, store `localCache`). */
export async function setCachedEntity<TData>(
  tenantId: string,
  entity: string,
  entityId: string,
  data: TData,
  updatedAt: string,
): Promise<void> {
  const db = await getDb();
  const record: LocalCacheRecord<TData> = {
    key: localCacheKey(tenantId, entity, entityId),
    tenantId,
    entity,
    entityId,
    data,
    updatedAt,
  };
  await db.put("localCache", record as LocalCacheRecord);
}

export async function getCachedEntity<TData>(
  tenantId: string,
  entity: string,
  entityId: string,
): Promise<LocalCacheRecord<TData> | undefined> {
  const db = await getDb();
  return db.get("localCache", localCacheKey(tenantId, entity, entityId)) as Promise<
    LocalCacheRecord<TData> | undefined
  >;
}

export async function listCachedEntities<TData>(
  tenantId: string,
  entity: string,
): Promise<LocalCacheRecord<TData>[]> {
  const db = await getDb();
  return db.getAllFromIndex("localCache", "by-entity", [tenantId, entity]) as Promise<
    LocalCacheRecord<TData>[]
  >;
}

export async function removeCachedEntity(
  tenantId: string,
  entity: string,
  entityId: string,
): Promise<void> {
  const db = await getDb();
  await db.delete("localCache", localCacheKey(tenantId, entity, entityId));
}
