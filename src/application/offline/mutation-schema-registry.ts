import type { z } from "zod";

/**
 * Registre en mémoire des schémas Zod de payload par entity, symétrique à
 * mutation-handler-registry.ts et peuplé au même endroit (chaque module
 * appelle registerMutationSchema depuis son fichier register-*-sync.ts).
 * Optionnel par entity : une entity sans schéma enregistré n'est pas
 * bloquée (voir sync-mutation.use-case.ts) — utile pour les tests qui
 * enregistrent un gestionnaire minimal sans vouloir brancher de validation.
 * Toute entity qui EN enregistre un voit en revanche son payload rejeté
 * proprement (ValidationError) avant tout accès au gestionnaire métier.
 */
const registry = new Map<string, z.ZodType>();

export function registerMutationSchema(entity: string, schema: z.ZodType): void {
  registry.set(entity, schema);
}

export function getMutationSchema(entity: string): z.ZodType | undefined {
  return registry.get(entity);
}
