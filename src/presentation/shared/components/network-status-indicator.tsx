"use client";

import { CircleAlert, RefreshCw, WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/presentation/shared/hooks/use-network-status";
import { syncLabels } from "@/presentation/shared/labels";
import { cn } from "@/lib/utils";

/**
 * Badge d'état réseau/sync — masqué en ligne sans mutation en attente (pas
 * de bruit visuel quand tout va bien). Cliquable pour forcer une
 * synchronisation manuelle quand des mutations sont en attente.
 */
export function NetworkStatusIndicator({
  tenantId,
  className,
}: {
  tenantId: string;
  className?: string;
}) {
  const { online, syncState, pendingCount, triggerSync } = useNetworkStatus(tenantId);

  if (online && syncState === "idle" && pendingCount === 0) {
    return null;
  }

  const label = !online
    ? pendingCount > 0
      ? syncLabels.offlinePending(pendingCount)
      : syncLabels.offline
    : syncState === "auth_required"
      ? syncLabels.authRequired
      : syncState === "syncing"
        ? syncLabels.syncing
        : syncState === "error"
          ? syncLabels.error
          : syncLabels.pending(pendingCount);

  // auth_required déclenche déjà une redirection vers /login (voir
  // network-status-store.ts) : retenter ici n'aurait aucun sens, la session
  // n'est plus valide tant que l'utilisateur ne s'est pas reconnecté.
  const canRetry =
    online && pendingCount > 0 && syncState !== "syncing" && syncState !== "auth_required";

  return (
    <button
      type="button"
      onClick={canRetry ? triggerSync : undefined}
      disabled={!canRetry}
      title={canRetry ? syncLabels.syncNow : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        !online || syncState === "error" || syncState === "auth_required"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground",
        canRetry && "cursor-pointer",
        className,
      )}
    >
      {!online ? (
        <WifiOff className="size-3.5 shrink-0" aria-hidden />
      ) : syncState === "syncing" ? (
        <RefreshCw className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : syncState === "error" || syncState === "auth_required" ? (
        <CircleAlert className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <RefreshCw className="size-3.5 shrink-0" aria-hidden />
      )}
      <span>{label}</span>
    </button>
  );
}
