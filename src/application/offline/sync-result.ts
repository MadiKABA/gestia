/**
 * Enveloppe de résultat des actions génériques de sync
 * (syncMutationAction/pullChangesAction, presentation/offline/actions.ts).
 * Les erreurs "classiques" (réseau, validation, bug serveur) continuent de
 * rejeter la promesse normalement — cette enveloppe ne sert qu'aux issues
 * qu'un appelant doit distinguer explicitement pour réagir différemment
 * (jamais un backoff generique) :
 * - "auth_required" : session expirée/absente pendant une synchronisation —
 *   la mutation reste en queue, l'appelant doit rediriger vers la connexion
 *   plutôt que retenter en boucle (voir infrastructure/offline/errors.ts).
 * - "rate_limited" : trop d'appels sur une courte période pour ce compte
 *   (voir infrastructure/shared/rate-limiter.ts) — traité comme un échec
 *   transitoire ordinaire par le backoff générique déjà en place, jamais
 *   une redirection ni une perte de la mutation en attente.
 */
export type SyncFailureReason = "auth_required" | "rate_limited";

export type SyncActionResult<TData> =
  { ok: true; data: TData } | { ok: false; reason: SyncFailureReason };
