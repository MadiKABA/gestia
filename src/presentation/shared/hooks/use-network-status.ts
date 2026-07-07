"use client";

import { useSyncExternalStore } from "react";
import type { SyncTransport } from "@/infrastructure/offline/sync-engine";
import type { PullTransport } from "@/infrastructure/offline/pull-engine";
import {
  getNetworkStatusStore,
  type SyncState,
} from "@/infrastructure/offline/network-status-store";
import { syncMutationAction, pullChangesAction } from "@/presentation/offline/actions";

export type { SyncState };

export type NetworkStatus = {
  online: boolean;
  syncState: SyncState;
  pendingCount: number;
  /** Déclenche une synchronisation immédiate (ex: bouton "Synchroniser maintenant"). */
  triggerSync: () => void;
};

/** Seul endroit qui enveloppe les Server Actions génériques en SyncTransport/
 * PullTransport — infrastructure/offline/ ne connaît que ces interfaces,
 * jamais Next.js. */
const syncTransport: SyncTransport = (mutation) => syncMutationAction(mutation);
const pullTransport: PullTransport = (input) => pullChangesAction(input);

export function useNetworkStatus(tenantId: string): NetworkStatus {
  const store = getNetworkStatusStore(tenantId, syncTransport, pullTransport);
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
  getNetworkStatusStore(tenantId, syncTransport, pullTransport).triggerSync();
}
