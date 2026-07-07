/**
 * Contrat générique qu'implémente chaque repository "offline-first" de
 * module métier (ex: futur `PartyOfflineRepository` dans
 * infrastructure/party/). Remplace l'appel direct à un repository Prisma
 * côté présentation : lit/écrit d'abord le cache local IndexedDB (affichage
 * instantané, fonctionne hors ligne), enfile la mutation dans la queue de
 * sync, tente une synchronisation immédiate si en ligne sans jamais bloquer
 * l'appelant sur la réponse serveur.
 *
 * `TInput` reste distinct de `T` : la création reçoit les données du
 * formulaire (sans id/timestamps), la lecture retourne l'entité complète.
 */
export interface OfflineFirstRepository<T, TInput, TFilters = void> {
  create(data: TInput): Promise<T>;
  update(id: string, data: TInput): Promise<T>;
  delete(id: string): Promise<void>;
  /** Lit le cache local en priorité — jamais d'attente réseau bloquante. */
  getById(id: string): Promise<T | null>;
  /** Lit le cache local ; rafraîchit en arrière-plan si en ligne. */
  list(filters: TFilters): Promise<T[]>;
}
