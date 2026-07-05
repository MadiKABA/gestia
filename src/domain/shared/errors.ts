/** Erreurs métier communes à tout le domaine, indépendantes de Next.js/Prisma. */

export class DomainError extends Error {}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} introuvable (id: ${id})`);
    this.name = "NotFoundError";
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
