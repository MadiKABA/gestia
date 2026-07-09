"use client";

import { useSyncExternalStore } from "react";

/** Toujours `false` côté serveur/premier rendu (pas de `window`) — évite tout
 * mismatch d'hydratation, quitte à corriger la valeur au montage client. */
function subscribe(query: string, onChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(query);
  mediaQueryList.addEventListener("change", onChange);
  return () => mediaQueryList.removeEventListener("change", onChange);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => window.matchMedia(query).matches,
    () => false,
  );
}
