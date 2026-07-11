/**
 * Signale une session expirée/absente détectée pendant une synchronisation
 * (push ou pull) — jamais traitée comme un échec de mutation ordinaire :
 * pas de backoff exponentiel, pas de retryCount incrémenté (voir
 * sync-engine.ts/pull-engine.ts). La mutation reste intacte en queue ; la
 * reprise se fait automatiquement au prochain cycle de sync déclenché après
 * reconnexion (network-status-store.ts redirige vers /login sur cette
 * erreur, jamais de perte de la mutation en attente).
 */
export class AuthRequiredError extends Error {
  constructor() {
    super("Authentification requise pour synchroniser");
    this.name = "AuthRequiredError";
  }
}

/**
 * Erreur de validation métier définitive rencontrée pendant une
 * synchronisation (reason "validation_error" de SyncActionResult, voir
 * application/offline/sync-result.ts) — jamais traitée comme un échec
 * transitoire ordinaire par sync-engine.ts : pas de backoff, la mutation
 * est retirée de la boucle de retry via `markMutationPermanentlyFailed`
 * (mutation-queue.store.ts) dès qu'elle est rencontrée, plutôt que
 * retentée indéfiniment à chaque cycle.
 */
export class PermanentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentValidationError";
  }
}

/**
 * Dépendance introuvable rencontrée pendant une synchronisation (reason
 * "dependency_not_found" de SyncActionResult) — ni transitoire (le réseau
 * fonctionne, le serveur a bien répondu) ni définitive comme
 * `PermanentValidationError` (la dépendance peut très bien exister déjà
 * ailleurs dans la queue, pas encore traitée à ce rang). sync-engine.ts la
 * reporte en fin de cycle plutôt que d'arrêter tout le passage ou de la
 * classer immédiatement en échec : voir ARCHITECTURE.md "Trois catégories
 * d'erreur pendant le push".
 */
export class DependencyPendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DependencyPendingError";
  }
}
