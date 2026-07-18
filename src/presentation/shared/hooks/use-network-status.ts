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
  /** Mutations en échec définitif — voir network-status-store.ts et
   * presentation/offline/components/sync-failures-panel.tsx. */
  failedCount: number;
  /** Incrémenté à chaque cycle de pull terminé — voir
   * network-status-store.ts:NetworkStatusSnapshot.syncVersion. À utiliser en
   * dépendance d'effet par les listes offline-first (ProductsList etc.) pour
   * se relire après un pull réussi en arrière-plan. */
  syncVersion: number;
  /** Déclenche une synchronisation immédiate (ex: bouton "Synchroniser maintenant"). */
  triggerSync: () => void;
};

/**
 * Seul endroit qui enveloppe les Server Actions génériques en SyncTransport/
 * PullTransport — infrastructure/offline/ ne connaît que ces interfaces,
 * jamais Next.js. `syncTransport` est exporté (pas seulement utilisé en
 * interne) pour être injecté tel quel dans les repositories offline-first
 * de module métier (ex: presentation/payment/offline-repository.ts) — même
 * transport que celui utilisé par la sync différée, jamais un deuxième
 * wrapping de syncMutationAction.
 */
export const syncTransport: SyncTransport = (mutation) => syncMutationAction(mutation);
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
