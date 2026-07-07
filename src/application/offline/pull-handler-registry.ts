import type { PullHandler } from "@/application/offline/pull-handler";

/**
 * Registre en mémoire des gestionnaires de pull par entity, peuplé au
 * démarrage du serveur — même mécanisme que mutation-handler-registry.ts
 * (voir le commentaire de ce fichier pour le contrat). Un registre distinct
 * plutôt que de réutiliser celui du push : les deux directions ont des
 * cycles de vie et des signatures différents (push dispatch par action,
 * pull dispatch par requête paginée), les mélanger imposerait un type union
 * artificiel aux deux moteurs génériques (sync-engine.ts / pull-engine.ts).
 */
const registry = new Map<string, PullHandler>();

export function registerPullHandler(entity: string, handler: PullHandler): void {
  registry.set(entity, handler);
}

export function getPullHandler(entity: string): PullHandler | undefined {
  return registry.get(entity);
}
