import { getDb, type SyncCursorRecord } from "@/infrastructure/offline/db";

function cursorKey(tenantId: string, entity: string): string {
  return `${tenantId}:${entity}`;
}

/** CRUD du curseur de synchronisation descendante (IndexedDB, store `syncCursors`). */
export async function getCursor(
  tenantId: string,
  entity: string,
): Promise<SyncCursorRecord | undefined> {
  const db = await getDb();
  return db.get("syncCursors", cursorKey(tenantId, entity));
}

export async function setCursor(
  tenantId: string,
  entity: string,
  lastSyncedAt: string,
): Promise<void> {
  const db = await getDb();
  const record: SyncCursorRecord = {
    key: cursorKey(tenantId, entity),
    tenantId,
    entity,
    lastSyncedAt,
  };
  await db.put("syncCursors", record);
}
