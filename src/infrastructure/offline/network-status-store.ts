import { syncQueue, type SyncTransport } from "@/infrastructure/offline/sync-engine";
import { listPendingMutations } from "@/infrastructure/offline/mutation-queue.store";

export type SyncState = "idle" | "syncing" | "pending" | "error";

export type NetworkStatusSnapshot = {
  online: boolean;
  syncState: SyncState;
  pendingCount: number;
};

const SERVER_SNAPSHOT: NetworkStatusSnapshot = { online: true, syncState: "idle", pendingCount: 0 };
const PERIODIC_SYNC_INTERVAL_MS = 30_000;

/**
 * Store framework-agnostic (pas de dépendance React ni Next.js ici — voir
 * presentation/shared/hooks/use-network-status.ts pour le hook qui
 * l'expose via useSyncExternalStore, et qui fournit le vrai `syncTransport`
 * enveloppant la Server Action). Vit dans infrastructure/offline/ pour
 * rester importable par les futurs repositories offline-first de module
 * métier (ex: PartyOfflineRepository) — le transport reste injecté, jamais
 * importé en dur ici : ça garderait infrastructure/ dépendant de
 * presentation/, sens interdit dans cette architecture.
 */
export class NetworkStatusStore {
  private snapshot: NetworkStatusSnapshot = SERVER_SNAPSHOT;
  private listeners = new Set<() => void>();
  private initialized = false;
  private syncing = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly tenantId: string,
    private readonly syncTransport: SyncTransport,
  ) {}

  getSnapshot = (): NetworkStatusSnapshot => this.snapshot;

  getServerSnapshot = (): NetworkStatusSnapshot => SERVER_SNAPSHOT;

  subscribe = (listener: () => void): (() => void) => {
    this.ensureInitialized();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Non bloquant, jamais attendu par l'appelant (cf. PartyOfflineRepository). */
  triggerSync = (): void => {
    this.ensureInitialized();
    void this.runSync();
  };

  private publish(patch: Partial<NetworkStatusSnapshot>) {
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
      const result = await syncQueue({
        tenantId: this.tenantId,
        syncTransport: this.syncTransport,
      });
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

export function getNetworkStatusStore(
  tenantId: string,
  syncTransport: SyncTransport,
): NetworkStatusStore {
  let store = stores.get(tenantId);
  if (!store) {
    store = new NetworkStatusStore(tenantId, syncTransport);
    stores.set(tenantId, store);
  }
  return store;
}
