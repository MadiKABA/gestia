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
