import type { PullChangesResult } from "@/application/offline/pull-changes.use-case";
import { getCursor, setCursor } from "@/infrastructure/offline/sync-cursor.store";
import { removeCachedEntity, setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { hasPendingMutationFor } from "@/infrastructure/offline/mutation-queue.store";

/**
 * Appel réseau réel vers le serveur pour une page de pull — injecté comme
 * `SyncTransport` côté push, pour les mêmes raisons (testable, indépendant
 * de Next.js ; le transport réel enveloppe la Server Action générique
 * `pullChangesAction`, voir presentation/shared/hooks/use-network-status.ts).
 */
export type PullTransport = (input: {
  entity: string;
  since: string;
  pageCursor?: string;
}) => Promise<PullChangesResult>;

export type PullEntityResult = { applied: number; skipped: number };

const EPOCH = new Date(0).toISOString();

/**
 * Rejoue le pull d'une entity pour un tenant : lit le dernier curseur
 * connu, tire toutes les pages depuis ce point, fusionne chaque
 * enregistrement dans le cache local — retire l'entrée si `deletedAt` est
 * renseigné (suppression serveur à répercuter, jamais garder affiché),
 * sinon écrase avec la valeur serveur. Toute entité ayant une mutation
 * locale encore en attente (voir hasPendingMutationFor) est sautée : ce
 * pull ne doit jamais écraser une édition optimiste pas encore poussée —
 * elle sera correctement réconciliée une fois cette mutation synchronisée,
 * via le mécanisme de conflit dernier-écrit-gagne déjà en place côté push.
 *
 * Le curseur n'avance qu'une fois TOUTES les pages de ce cycle appliquées
 * avec succès (le `since` envoyé à chaque page reste le curseur d'ORIGINE,
 * jamais réassigné en cours de boucle) : une erreur en cours de pagination
 * laisse le curseur intact, le prochain pull repart du même point — fusion
 * idempotente, aucun risque à réappliquer des enregistrements déjà à jour.
 */
export async function pullEntity(deps: {
  tenantId: string;
  entity: string;
  pullTransport: PullTransport;
}): Promise<PullEntityResult> {
  const cursor = await getCursor(deps.tenantId, deps.entity);
  const since = cursor?.lastSyncedAt ?? EPOCH;

  let pageCursor: string | undefined;
  let latestServerTimestamp = since;
  let applied = 0;
  let skipped = 0;

  do {
    const result = await deps.pullTransport({ entity: deps.entity, since, pageCursor });
    latestServerTimestamp = result.serverTimestamp;

    for (const record of result.records) {
      const pending = await hasPendingMutationFor(deps.tenantId, deps.entity, record.id);
      if (pending) {
        skipped += 1;
        continue;
      }
      if (record.deletedAt) {
        await removeCachedEntity(deps.tenantId, deps.entity, record.id);
      } else {
        await setCachedEntity(deps.tenantId, deps.entity, record.id, record.data, record.updatedAt);
      }
      applied += 1;
    }

    pageCursor = result.nextPageCursor;
  } while (pageCursor);

  await setCursor(deps.tenantId, deps.entity, latestServerTimestamp);
  return { applied, skipped };
}
