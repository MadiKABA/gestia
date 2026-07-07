/**
 * Registre client des entities à rafraîchir par pull — symétrique côté
 * lecture du principe déjà en place côté écriture (chaque module métier
 * s'enregistre plutôt que d'être connu en dur par le moteur générique), mais
 * purement en mémoire navigateur : aucun serveur à contacter pour savoir
 * "quoi" tirer, seulement pour l'exécuter (voir pull-engine.ts).
 *
 * Un module métier s'enregistre une fois au montage de l'app cliente (ex :
 * futur `registerPullableEntity("party")` lors du retrofit Party) — le cycle
 * de sync (network-status-store.ts) itère ensuite sur cette liste à chaque
 * pull sans connaître aucun module métier lui-même.
 */
const pullableEntities = new Set<string>();

export function registerPullableEntity(entity: string): void {
  pullableEntities.add(entity);
}

export function listPullableEntities(): string[] {
  return [...pullableEntities];
}
