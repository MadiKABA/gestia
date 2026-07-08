/**
 * Limiteur de débit générique, fenêtre glissante, en mémoire (un `Map`
 * module-level) — délibérément pas persisté en base, à la différence du
 * rate limiting des demandes d'OTP (`findRecentOtpRequestTimestamps`,
 * DB-backed) : les endpoints de sync sont appelés bien plus fréquemment
 * (polling + chaque mutation) qu'une demande d'OTP, un aller-retour DB à
 * chaque appel serait un coût disproportionné pour un bénéfice marginal sur
 * l'infra VPS mono-instance actuelle. Limitation assumée : se réinitialise
 * au redémarrage du serveur, aucune protection si l'infra devient
 * multi-instance — acceptable pour ce cas d'usage (protéger contre un
 * client buggé en boucle de retry, pas contre une attaque distribuée).
 *
 * Défini et consommé directement par le module qui l'utilise
 * (presentation/offline/actions.ts, src/app/api/sync/route.ts) plutôt que
 * par un import passant par instrumentation.ts — leçon du bug de registre
 * de mutation-handler-registry.ts : Next.js bundle instrumentation.ts dans
 * un graphe de modules séparé en production, un singleton en mémoire
 * rempli là-bas n'est pas visible depuis les Server Actions/Route Handlers.
 */

type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

/** Politique des endpoints de synchronisation (push/pull, Server Actions et
 * /api/sync) — 60 appels/minute par tenant+utilisateur laisse largement de
 * la marge au polling (un appel toutes les 30-60s) et aux rafales de
 * mutations, tout en bornant un client buggé en boucle de retry. */
export const SYNC_RATE_LIMIT: RateLimitConfig = { limit: 60, windowMs: 60_000 };

const requestTimestampsByKey = new Map<string, number[]>();

/**
 * Vrai si l'appel est autorisé (et l'enregistre) ; faux si `key` a déjà
 * atteint `limit` appels dans les `windowMs` dernières millisecondes.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const recent = (requestTimestampsByKey.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= config.limit) {
    requestTimestampsByKey.set(key, recent);
    return false;
  }

  recent.push(now);
  requestTimestampsByKey.set(key, recent);
  return true;
}

/** Réservé aux tests : évite qu'un test pollue le suivant via le Map module-level. */
export function resetRateLimiter(): void {
  requestTimestampsByKey.clear();
}
