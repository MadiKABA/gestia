"use client";

import { useSyncExternalStore } from "react";
import type { SyncTransport } from "@/infrastructure/offline/sync-engine";
import {
  getNetworkStatusStore,
  type SyncState,
} from "@/infrastructure/offline/network-status-store";
import { syncMutationAction } from "@/presentation/offline/actions";

export type { SyncState };

export type NetworkStatus = {
  online: boolean;
  syncState: SyncState;
  pendingCount: number;
  /** Déclenche une synchronisation immédiate (ex: bouton "Synchroniser maintenant"). */
  triggerSync: () => void;
};

/** Seul endroit qui enveloppe la Server Action générique en SyncTransport —
 * infrastructure/offline/ ne connaît que l'interface, jamais Next.js. */
const syncTransport: SyncTransport = (mutation) => syncMutationAction(mutation);

export function useNetworkStatus(tenantId: string): NetworkStatus {
  const store = getNetworkStatusStore(tenantId, syncTransport);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { ...snapshot, triggerSync: store.triggerSync };
}

/**
 * Version non-React, pour les repositories offline-first (ex:
 * PartyOfflineRepository) qui doivent nudger une synchronisation après
 * avoir enfilé une mutation, sans jamais bloquer l'appelant.
 */
export function triggerBackgroundSync(tenantId: string): void {
  getNetworkStatusStore(tenantId, syncTransport).triggerSync();
}
