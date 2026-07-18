"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSerwist } from "@serwist/turbopack/react";
import { Button } from "@/presentation/shared/components/ui/button";
import { pwaLabels } from "@/presentation/shared/labels";

/**
 * Bannière "nouvelle version disponible" — sw.ts n'appelle plus
 * self.skipWaiting() automatiquement (voir son commentaire) : un nouveau
 * service worker installé reste "waiting" jusqu'à ce que l'utilisateur
 * confirme ici, plutôt que de prendre le contrôle en silence en plein milieu
 * d'une saisie. `serwist.messageSkipWaiting()` déclenche l'activation ; le
 * rechargement suit l'événement "controlling" (déclenché par le
 * `controllerchange` natif une fois le nouveau service worker actif), jamais
 * un délai fixe arbitraire.
 */
export function PwaUpdateBanner() {
  const { serwist } = useSerwist();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!serwist) return;

    function onWaiting() {
      setUpdateAvailable(true);
    }
    function onControlling() {
      window.location.reload();
    }

    serwist.addEventListener("waiting", onWaiting);
    serwist.addEventListener("controlling", onControlling);
    return () => {
      serwist.removeEventListener("waiting", onWaiting);
      serwist.removeEventListener("controlling", onControlling);
    };
  }, [serwist]);

  if (!updateAvailable) return null;

  function applyUpdate() {
    setUpdating(true);
    serwist?.messageSkipWaiting();
  }

  return (
    <div className="bg-primary text-primary-foreground flex items-center gap-3 px-4 py-2.5 text-sm">
      <RefreshCw className="size-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 font-medium">{pwaLabels.updateAvailableTitle}</p>
      <Button size="sm" variant="secondary" onClick={applyUpdate} disabled={updating}>
        {updating ? pwaLabels.updateApplying : pwaLabels.updateButton}
      </Button>
    </div>
  );
}
