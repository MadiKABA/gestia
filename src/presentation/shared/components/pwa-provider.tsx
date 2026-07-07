"use client";

import type { ReactNode } from "react";
import { SerwistProvider } from "@serwist/turbopack/react";

/**
 * Enregistre le service worker (src/app/sw.ts, servi à /serwist/sw.js par
 * src/app/serwist/[path]/route.ts). Désactivé en dev — comportement standard
 * recommandé Serwist, évite les soucis de cache pendant le développement
 * (voir README "Tester la PWA en local").
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>
      {children}
    </SerwistProvider>
  );
}
