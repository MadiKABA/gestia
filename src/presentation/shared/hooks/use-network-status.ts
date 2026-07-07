"use client";

import { useSyncExternalStore } from "react";
import { syncQueue, type SyncTransport } from "@/infrastructure/offline/sync-engine";
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";
import { syncMutationAction } from "@/presentation/offline/actions";

export type SyncState = "idle" | "syncing" | "pending" | "error";

export type NetworkStatus = {
  online: boolean;
  syncState: SyncState;
  pendingCount: number;
  /** Déclenche une synchronisation immédiate (ex: bouton "Synchroniser maintenant"). */
  triggerSync: () => void;
};

type Snapshot = {
  online: boolean;
  syncState: SyncState;
  pendingCount: number;
};

const SERVER_SNAPSHOT: Snapshot = { online: true, syncState: "idle", pendingCount: 0 };
const PERIODIC_SYNC_INTERVAL_MS = 30_000;

const syncTransport: SyncTransport = (mutation) => syncMutationAction(mutation);

/**
 * État exposé via un store externe (comme install-prompt-banner.tsx) plutôt
 * que useState+useEffect : `navigator.onLine` et la lecture de la queue
 * IndexedDB n'existent pas côté serveur, `getServerSnapshot` évite tout
 * mismatch d'hydratation. Un seul store par tenant — la clé du Map couvre le
 * cas (rare mais possible) de plusieurs tenants ouverts dans le même
 * navigateur.
 */
class NetworkStatusStore {
  private snapshot: Snapshot = SERVER_SNAPSHOT;
  private listeners = new Set<() => void>();
  private initialized = false;
  private syncing = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly tenantId: string) {}

  getSnapshot = (): Snapshot => this.snapshot;

  getServerSnapshot = (): Snapshot => SERVER_SNAPSHOT;

  subscribe = (listener: () => void): (() => void) => {
    this.ensureInitialized();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  triggerSync = (): void => {
    void this.runSync();
  };

  private publish(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;

    this.publish({ online: navigator.onLine });
    void this.refreshPendingCount().then((count) => {
      if (count > 0 && navigator.onLine) void this.runSync();
    });

    window.addEventListener("online", () => {
      this.publish({ online: true });
      void this.runSync();
    });
    window.addEventListener("offline", () => {
      this.publish({ online: false });
    });

    setInterval(() => {
      if (navigator.onLine) void this.runSync();
    }, PERIODIC_SYNC_INTERVAL_MS);
  }

  private async refreshPendingCount(): Promise<number> {
    const pending = await listPendingMutations(this.tenantId);
    this.publish({ pendingCount: pending.length });
    return pending.length;
  }

  private async runSync(): Promise<void> {
    if (this.syncing || !navigator.onLine) return;
    this.syncing = true;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.publish({ syncState: "syncing" });
    try {
      const result = await syncQueue({ tenantId: this.tenantId, syncTransport });
      const count = await this.refreshPendingCount();
      if (result.failed) {
        this.publish({ syncState: "error" });
        this.retryTimeout = setTimeout(() => {
          void this.runSync();
        }, result.nextRetryDelayMs);
      } else {
        this.publish({ syncState: count > 0 ? "pending" : "idle" });
      }
    } finally {
      this.syncing = false;
    }
  }
}

const stores = new Map<string, NetworkStatusStore>();

function getStore(tenantId: string): NetworkStatusStore {
  let store = stores.get(tenantId);
  if (!store) {
    store = new NetworkStatusStore(tenantId);
    stores.set(tenantId, store);
  }
  return store;
}

export function useNetworkStatus(tenantId: string): NetworkStatus {
  const store = getStore(tenantId);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { ...snapshot, triggerSync: store.triggerSync };
}
