/**
 * Enveloppe de résultat des actions génériques de sync
 * (syncMutationAction/pullChangesAction, presentation/offline/actions.ts).
 * Les erreurs "classiques" (réseau, bug serveur) continuent de rejeter la
 * promesse normalement — cette enveloppe ne sert qu'aux issues qu'un
 * appelant doit distinguer explicitement pour réagir différemment (jamais
 * un backoff generique) :
 * - "auth_required" : session expirée/absente pendant une synchronisation —
 *   la mutation reste en queue, l'appelant doit rediriger vers la connexion
 *   plutôt que retenter en boucle (voir infrastructure/offline/errors.ts).
 * - "rate_limited" : trop d'appels sur une courte période pour ce compte
 *   (voir infrastructure/shared/rate-limiter.ts) — traité comme un échec
 *   transitoire ordinaire par le backoff générique déjà en place, jamais
 *   une redirection ni une perte de la mutation en attente.
 * - "validation_error" : `ValidationError` levée par le use case applicatif
 *   (schéma Zod invalide, règle métier violée, ex. "montant supérieur au
 *   solde restant") — définitive, ce payload ne deviendra jamais valide en
 *   le renvoyant tel quel. Porte le message métier (déjà en vocabulaire
 *   commerçant, cf. domain/shared/errors.ts) car une classe d'erreur ne
 *   survit pas à la sérialisation d'une Server Action (seul `message`
 *   traverse) — voir infrastructure/offline/sync-engine.ts, qui distingue
 *   ce cas d'un échec transitoire au lieu de retenter indéfiniment.
 * - "dependency_not_found" : `DependencyNotFoundError` — la mutation
 *   référence une autre entité (ex. `partyId` d'une Transaction) introuvable
 *   en base *pour l'instant*, typiquement parce qu'elle a été créée hors
 *   ligne dans la même session et n'a pas encore été synchronisée elle-même.
 *   Contrairement à "validation_error", ce n'est pas définitif : voir
 *   infrastructure/offline/sync-engine.ts, qui reporte cette mutation en fin
 *   de cycle plutôt que de la rejeter immédiatement.
 */
export type SyncFailureReason =
  "auth_required" | "rate_limited" | "validation_error" | "dependency_not_found";

export type SyncActionResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; reason: "validation_error"; message: string }
  | { ok: false; reason: "dependency_not_found"; message: string }
  | {
      ok: false;
      reason: Exclude<SyncFailureReason, "validation_error" | "dependency_not_found">;
    };
