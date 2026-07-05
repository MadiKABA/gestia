export async function register() {
  // Fail-fast : toute variable d'environnement manquante ou invalide arrête le
  // démarrage du serveur ici plutôt qu'en pleine requête (cahier des charges §9).
  await import("@/lib/env");
}
