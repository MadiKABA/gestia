/**
 * Préfixes des routes d'authentification (connexion, inscription, reset PIN,
 * première connexion vendeur). Source unique partagée entre `src/proxy.ts`
 * (redirection selon session) et `src/app/sw.ts` (exclusion explicite du
 * cache Service Worker) — ces deux usages doivent toujours viser exactement
 * les mêmes routes, jamais une liste dupliquée qui pourrait diverger.
 */
export const AUTH_ROUTE_PREFIXES = [
  "/login",
  "/register",
  "/reset-pin",
  "/premiere-connexion",
] as const;
