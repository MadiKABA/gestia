/** Erreurs métier communes à tout le domaine, indépendantes de Next.js/Prisma. */

export class DomainError extends Error {}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} introuvable (id: ${id})`);
    this.name = "NotFoundError";
  }
}

/**
 * Cas particulier de `NotFoundError` : l'entité manquante n'est pas celle
 * visée par la mutation elle-même, mais une dépendance qu'elle référence
 * (ex. `Party` pour une `Transaction`, `Transaction` pour un `Payment`) —
 * hérite de `NotFoundError` pour rester compatible avec tout code existant
 * qui catch cette dernière, mais reste distinguable via `instanceof
 * DependencyNotFoundError` là où ça compte : le moteur de sync différée
 * (infrastructure/offline/sync-engine.ts) la traite différemment d'un
 * `NotFoundError` ordinaire, car elle peut se résoudre d'elle-même dès que
 * la dépendance finit par se synchroniser (voir ARCHITECTURE.md).
 */
export class DependencyNotFoundError extends NotFoundError {
  constructor(entity: string, id: string) {
    super(entity, id);
    this.name = "DependencyNotFoundError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Action non autorisée") {
    super(message);
    this.name = "ForbiddenError";
  }
}
