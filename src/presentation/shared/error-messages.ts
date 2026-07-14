import { DependencyNotFoundError, ForbiddenError, ValidationError } from "@/domain/shared/errors";
import { commonLabels } from "@/presentation/shared/labels";

/**
 * Traduit une erreur attrapée côté client en message affichable au
 * commerçant — jamais un nom de classe ou une trace technique par défaut.
 *
 * `ValidationError` (et non `NotFoundError` de base, dont le message par
 * défaut expose un id technique — "Party introuvable (id: ...)") porte déjà
 * un texte français clair, curaté au plus près de la règle métier violée
 * (voir tous les `throw new ValidationError(...)` du domaine) : on le laisse
 * traverser tel quel plutôt que de le dupliquer ici. `ForbiddenError` et
 * `DependencyNotFoundError` ont un message par défaut/générique (le premier
 * ne varie jamais, le second embarque un id) — remplacés par un texte fixe.
 * Toute autre erreur (réseau, bug non prévu, digest de production Next.js)
 * retombe sur le message générique de repli, jamais affichée telle quelle.
 */
export function resolveErrorMessage(error: unknown): string {
  if (error instanceof DependencyNotFoundError) {
    return commonLabels.dependencyNotFoundErrorMessage;
  }
  if (error instanceof ValidationError) {
    return error.message;
  }
  if (error instanceof ForbiddenError) {
    return commonLabels.forbiddenErrorMessage;
  }
  return commonLabels.genericErrorToastMessage;
}
