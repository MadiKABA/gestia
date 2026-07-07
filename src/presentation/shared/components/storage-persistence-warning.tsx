"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import {
  isStoragePersisted,
  requestPersistentStorage,
} from "@/infrastructure/offline/storage-persistence";
import { storageLabels } from "@/presentation/shared/labels";

const SESSION_DISMISS_KEY = "gestia:storage-warning-dismissed";

/**
 * Demande la persistance du stockage une fois par montage du dashboard, et
 * avertit seulement si le navigateur a refusé — rare sur une PWA installée,
 * plus fréquent en navigateur simple (voir ARCHITECTURE.md "Limitations
 * iOS"). Toujours masqué au premier rendu (avant l'effet) : aucun risque de
 * mismatch d'hydratation, sessionStorage/navigator.storage n'existent pas
 * côté serveur.
 */
export function StoragePersistenceWarning() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") return;
    let cancelled = false;
    void requestPersistentStorage().then(async (granted) => {
      if (granted) return;
      const persisted = await isStoragePersisted();
      if (!cancelled && !persisted) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="bg-destructive/10 text-destructive flex items-center gap-3 px-4 py-2.5 text-sm">
      <TriangleAlert className="size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{storageLabels.warningTitle}</p>
        <p className="text-destructive/80 text-xs">{storageLabels.warningDescription}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={storageLabels.dismissAria}
        className="hover:bg-destructive/10 shrink-0 rounded-md p-1"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
