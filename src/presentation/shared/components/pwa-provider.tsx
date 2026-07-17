"use client";

import { useEffect, type ReactNode } from "react";
import { SerwistProvider, useSerwist } from "@serwist/turbopack/react";

/**
 * Chrome ne revérifie une mise à jour du Service Worker qu'à l'occasion
 * d'une requête réseau vers son script, throttlée à ~1x/24h — une PWA
 * installée simplement reprise depuis l'arrière-plan Android (sans
 * navigation complète) peut ne jamais déclencher cette vérification et
 * rester bloquée sur un Service Worker (et son cache) antérieur au dernier
 * déploiement bien plus longtemps que prévu. On force donc explicitement
 * `registration.update()` à chaque reprise au premier plan.
 */
function SwUpdateOnResume() {
  const { serwist } = useSerwist();

  useEffect(() => {
    if (!serwist) return;

    const updateIfVisible = () => {
      if (document.visibilityState === "visible") {
        void serwist.update();
      }
    };

    document.addEventListener("visibilitychange", updateIfVisible);
    window.addEventListener("focus", updateIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", updateIfVisible);
      window.removeEventListener("focus", updateIfVisible);
    };
  }, [serwist]);

  return null;
}

/**
 * Enregistre le service worker (src/app/sw.ts, servi à /serwist/sw.js par
 * src/app/serwist/[path]/route.ts). Désactivé en dev — comportement standard
 * recommandé Serwist, évite les soucis de cache pendant le développement
 * (voir README "Tester la PWA en local").
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>
      <SwUpdateOnResume />
      {children}
    </SerwistProvider>
  );
}
