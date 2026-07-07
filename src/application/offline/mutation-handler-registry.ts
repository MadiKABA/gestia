import type { MutationHandler } from "@/application/offline/mutation-handler";

/**
 * Registre en mémoire des gestionnaires de mutation par entity, peuplé au
 * démarrage du serveur (voir src/instrumentation.ts et le fichier
 * d'enregistrement de chaque module, ex: infrastructure/party/register-party-sync.ts).
 * Le moteur de sync générique (sync-mutation.use-case.ts) ne connaît que
 * cette interface — jamais un module métier directement.
 */
const registry = new Map<string, MutationHandler>();

export function registerMutationHandler(entity: string, handler: MutationHandler): void {
  registry.set(entity, handler);
}

export function getMutationHandler(entity: string): MutationHandler | undefined {
  return registry.get(entity);
}
