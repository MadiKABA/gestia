import type { TenantContext } from "@/domain/shared/tenant-context";
import { ValidationError } from "@/domain/shared/errors";
import { getPullHandler } from "@/application/offline/pull-handler-registry";
import type { PulledRecord } from "@/application/offline/pull-handler";

export type PullChangesResult<TData = unknown> = {
  records: PulledRecord<TData>[];
  nextPageCursor?: string;
  /** Nouveau curseur à persister par le client une fois toutes les pages de
   * ce cycle de pull appliquées avec succès (voir pull-engine.ts). */
  serverTimestamp: string;
};

/**
 * Point d'entrée serveur générique du pull (symétrique à
 * sync-mutation.use-case.ts côté push) — dispatch vers le gestionnaire
 * enregistré pour `entity`, ne connaît aucune règle métier lui-même.
 * `context.tenantId` vient toujours de la session côté appelant
 * (presentation/offline/actions.ts), jamais d'une valeur transmise par le
 * client — cette fonction ne fait que le relayer au handler.
 */
export async function pullChanges(
  context: TenantContext,
  entity: string,
  since: Date,
  pageCursor?: string,
): Promise<PullChangesResult> {
  const handler = getPullHandler(entity);
  if (!handler) {
    throw new ValidationError(`Aucun gestionnaire de pull pour "${entity}"`);
  }

  // Capturé avant la requête, jamais après : devient le prochain curseur
  // client. Une ligne écrite pendant l'exécution de la requête sera
  // simplement re-proposée au prochain pull (son updatedAt sera postérieur à
  // ce serverTimestamp) plutôt que risquer de la manquer si l'horodatage
  // était capturé une fois la requête terminée.
  const queryStartedAt = new Date();
  const { records, nextPageCursor } = await handler.findChangedSince(
    context,
    since,
    queryStartedAt,
    pageCursor,
  );

  return { records, nextPageCursor, serverTimestamp: queryStartedAt.toISOString() };
}
