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
 */
export type SyncFailureReason = "auth_required";

export type SyncActionResult<TData> =
  { ok: true; data: TData } | { ok: false; reason: SyncFailureReason };
