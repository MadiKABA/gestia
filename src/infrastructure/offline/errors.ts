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
