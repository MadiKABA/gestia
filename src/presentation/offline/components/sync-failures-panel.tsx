"use client";

import { useCallback, useEffect, useState } from "react";
import type { MutationQueueRecord } from "@/infrastructure/offline/db";
import {
  discardMutation,
  listFailedMutations,
} from "@/infrastructure/offline/mutation-queue.store";
import { triggerBackgroundSync } from "@/presentation/shared/hooks/use-network-status";
import { ConfirmDialog } from "@/presentation/shared/components/confirm-dialog";
import { syncFailuresLabels } from "@/presentation/shared/labels";

/**
 * Réponse produit à l'exigence "aucune divergence écrasée silencieusement"
 * (cahier des charges §9) côté échecs définitifs : liste les mutations
 * marquées `permanentlyFailed` par sync-engine.ts (voir
 * markMutationPermanentlyFailed, mutation-queue.store.ts) — jamais
 * retentées automatiquement, mais jamais perdues sans que l'utilisateur en
 * soit informé. Lecture directe d'IndexedDB (pas de store partagé avec
 * useNetworkStatus) : cette page n'est visitée que ponctuellement, un
 * simple fetch au montage + après chaque résolution suffit.
 */
export function SyncFailuresPanel({ tenantId }: { tenantId: string }) {
  const [failures, setFailures] = useState<MutationQueueRecord[] | null>(null);
  const [toDiscard, setToDiscard] = useState<MutationQueueRecord | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const refresh = useCallback(() => {
    void listFailedMutations(tenantId).then(setFailures);
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onConfirmDiscard() {
    if (!toDiscard) return;
    setDiscarding(true);
    try {
      await discardMutation(toDiscard.id);
      // Un update/delete abandonné laisse le cache local sur l'édition
      // optimiste : seul un pull la corrige avec la vraie valeur serveur
      // (voir le commentaire de discardMutation, mutation-queue.store.ts).
      triggerBackgroundSync(tenantId);
      setToDiscard(null);
      refresh();
    } finally {
      setDiscarding(false);
    }
  }

  if (failures === null) return null;

  if (failures.length === 0) {
    return <p className="text-muted-foreground text-sm">{syncFailuresLabels.emptyState}</p>;
  }

  return (
    <>
      <ul className="bg-card border-border divide-border divide-y rounded-xl border text-sm shadow-xs">
        {failures.map((failure) => (
          <li key={failure.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-foreground font-medium">
                {syncFailuresLabels.actionLabel[failure.action]} —{" "}
                {syncFailuresLabels.entityLabel[failure.entity] ?? failure.entity}
              </p>
              <p className="text-destructive mt-0.5 text-xs">{failure.syncError}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {new Date(failure.createdAt).toLocaleString("fr-FR")}
              </p>
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive shrink-0 text-xs font-medium underline underline-offset-2"
              onClick={() => setToDiscard(failure)}
            >
              {syncFailuresLabels.discardButton}
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={toDiscard !== null}
        onOpenChange={(open) => {
          if (!open) setToDiscard(null);
        }}
        title={syncFailuresLabels.discardConfirmTitle}
        description={syncFailuresLabels.discardConfirmDescription}
        confirmLabel={syncFailuresLabels.discardButton}
        pending={discarding}
        onConfirm={() => void onConfirmDiscard()}
      />
    </>
  );
}
