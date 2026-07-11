import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncMutationResult } from "@/application/offline/sync-mutation.use-case";
import type { SyncActionResult, SyncFailureReason } from "@/application/offline/sync-result";
import {
  incrementDependencyDeferral,
  listPendingMutations,
  markMutationFailed,
  markMutationPermanentlyFailed,
  markMutationSynced,
} from "@/infrastructure/offline/mutation-queue.store";
import { getCachedEntity, setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import {
  AuthRequiredError,
  DependencyPendingError,
  PermanentValidationError,
} from "@/infrastructure/offline/errors";
import type { MutationQueueRecord } from "@/infrastructure/offline/db";

/**
 * Appel réseau réel vers le serveur pour une mutation — injecté plutôt
 * qu'importé en dur, pour ne dépendre d'aucun détail Next.js ici (le
 * transport réel, qui enveloppe la Server Action générique
 * `presentation/offline/actions.ts:syncMutationAction`, est fourni par
 * l'appelant — voir presentation/shared/hooks/use-network-status.ts).
 * Rejette normalement pour toute erreur inattendue (réseau, bug serveur) ;
 * ne résout `{ ok: false }` que pour les issues que l'appelant doit
 * distinguer explicitement, voir SyncActionResult.
 */
export type SyncTransport = (
  mutation: QueuedMutation,
) => Promise<SyncActionResult<SyncMutationResult>>;

export type SyncQueueResult = {
  succeeded: number;
  remaining: number;
  failed: boolean;
  nextRetryDelayMs?: number;
  reason?: SyncFailureReason;
};

const BASE_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Nombre de cycles complets consécutifs où une mutation peut être reportée
 * pour dépendance introuvable (`DependencyPendingError`) avant de basculer
 * en échec définitif vers l'interface de résolution
 * (sync-failures-panel.tsx). Chaque cycle laisse déjà une chance
 * supplémentaire à la dépendance via le second passage de `syncQueue`
 * ci-dessous — 5 cycles complets (déclenchés par reconnexion,
 * visibilitychange, ou le backoff automatique en cas d'échec) laissent
 * largement le temps à une dépendance légitimement en cours de
 * synchronisation d'arriver, tout en bornant à quelques minutes un vrai
 * blocage (ex. Party supprimé avant d'avoir pu être synchronisé).
 */
const MAX_DEPENDENCY_DEFER_CYCLES = 5;

/** Backoff simple, plafonné — pas de plafond de tentatives : une mutation
 * n'est jamais abandonnée (cahier des charges §9), seulement retentée de
 * moins en moins souvent. */
export function computeBackoffDelayMs(retryCount: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** retryCount, MAX_RETRY_DELAY_MS);
}

async function buildMutation(record: MutationQueueRecord): Promise<QueuedMutation> {
  const mutation: QueuedMutation = {
    id: record.id,
    tenantId: record.tenantId,
    entity: record.entity,
    action: record.action,
    payload: record.payload,
    clientGeneratedId: record.clientGeneratedId,
    createdAt: record.createdAt,
    createdById: record.createdById,
  };

  if (record.action === "update") {
    // Relu juste avant l'envoi, jamais figé à l'enfilement — voir le
    // commentaire sur QueuedMutation.clientKnownUpdatedAt. L'entrée de
    // cache existe encore pour un update (contrairement à un delete, dont
    // le cache est retiré dès l'enfilement).
    const cached = await getCachedEntity(record.tenantId, record.entity, record.clientGeneratedId);
    mutation.clientKnownUpdatedAt = cached?.updatedAt;
  } else if (record.action === "delete") {
    // Le cache local a déjà été retiré à l'enfilement (affichage
    // instantané) — la seule valeur disponible est celle figée alors.
    mutation.clientKnownUpdatedAt = record.clientKnownUpdatedAt;
  }

  return mutation;
}

/**
 * Tente une mutation unique. Résout normalement en cas de succès (le
 * bookkeeping — `markMutationSynced` + patch du cache — est déjà appliqué).
 * Rejette avec une erreur classifiée sinon (`PermanentValidationError`,
 * `DependencyPendingError`, `AuthRequiredError` ou `Error` générique pour
 * tout le reste) — à l'appelant (`syncQueue`) de décider quoi en faire selon
 * la catégorie.
 */
async function attemptMutation(
  syncTransport: SyncTransport,
  record: MutationQueueRecord,
): Promise<void> {
  const mutation = await buildMutation(record);
  const outcome = await syncTransport(mutation);

  if (!outcome.ok) {
    // "rate_limited" tombe dans le catch générique de l'appelant (backoff
    // exponentiel classique, comme une coupure réseau) — "auth_required",
    // "validation_error" et "dependency_not_found" ont chacun un traitement
    // dédié.
    if (outcome.reason === "auth_required") throw new AuthRequiredError();
    if (outcome.reason === "validation_error") throw new PermanentValidationError(outcome.message);
    if (outcome.reason === "dependency_not_found")
      throw new DependencyPendingError(outcome.message);
    throw new Error("Trop de synchronisations récentes, nouvelle tentative différée");
  }

  const result = outcome.data;
  await markMutationSynced(record.id, new Date().toISOString());

  if (record.action !== "delete") {
    const cached = await getCachedEntity(record.tenantId, record.entity, record.clientGeneratedId);
    if (cached) {
      await setCachedEntity(
        record.tenantId,
        record.entity,
        record.clientGeneratedId,
        cached.data,
        result.updatedAt,
      );
    }
  }
}

/** Erreur transitoire (réseau, session expirée, rate limit) ou bug serveur —
 * arrête tout le cycle en cours, quel que soit le passage (primaire ou
 * report des dépendances) : retenter d'autres mutations n'a pas de sens tant
 * que le réseau/la session est en cause. */
async function handleBlockingFailure(
  tenantId: string,
  record: MutationQueueRecord,
  error: unknown,
  succeeded: number,
): Promise<SyncQueueResult> {
  const remaining = (await listPendingMutations(tenantId)).length;

  if (error instanceof AuthRequiredError) {
    // Ni marquée échouée ni synced : la mutation reste intacte, sans
    // backoff — retenter immédiatement n'a aucun sens tant que la session
    // n'est pas renouvelée (voir network-status-store.ts, qui redirige vers
    // /login sur cette raison plutôt que de planifier une nouvelle
    // tentative).
    return { succeeded, remaining, failed: true, reason: "auth_required" };
  }

  const message = error instanceof Error ? error.message : String(error);
  const updated = await markMutationFailed(record.id, message);
  return {
    succeeded,
    remaining,
    failed: true,
    nextRetryDelayMs: computeBackoffDelayMs(updated?.retryCount ?? 1),
  };
}

/**
 * Rejoue les mutations en attente d'un tenant, dans l'ordre chronologique,
 * une par une (jamais en parallèle — l'ordre doit être respecté). S'arrête
 * à la première erreur *transitoire* (réseau, serveur indisponible, session
 * expirée) plutôt que de la sauter : sauter casserait l'ordre pour les
 * mutations suivantes sur la même entité, alors qu'un prochain cycle peut la
 * faire réussir.
 *
 * Une erreur de validation métier *définitive* (`PermanentValidationError`,
 * ex. "montant supérieur au solde restant") suit une règle différente : ce
 * payload ne deviendra jamais valide en le renvoyant tel quel, donc son sort
 * ne dépend plus d'aucune tentative future — elle est retirée de la queue de
 * retry (`markMutationPermanentlyFailed`, voir mutation-queue.store.ts) et
 * la boucle continue avec les mutations suivantes dans le même passage, sans
 * casser leur ordre (voir presentation/offline/components/sync-failures-panel.tsx
 * pour la résolution manuelle qui en découle).
 *
 * Une troisième catégorie, `DependencyPendingError` (ex. une Transaction
 * référence un Party pas encore synchronisé, créé hors ligne dans la même
 * session), suit une règle encore différente — ni transitoire ni définitive :
 * la mutation est reportée en fin de CE passage plutôt que de bloquer tout
 * le cycle, pour laisser la chance à sa dépendance (potentiellement plus
 * loin dans `pending`, si l'ordre s'est mal résolu en cas de collision de
 * `createdAt`, voir ARCHITECTURE.md) d'être traitée avant elle. Un second
 * passage retente ensuite chaque mutation reportée une seule fois. Si elle
 * échoue encore, `dependencyDeferredCycles` est incrémenté
 * (`incrementDependencyDeferral`, mutation-queue.store.ts) : en dessous de
 * `MAX_DEPENDENCY_DEFER_CYCLES`, elle reste simplement en attente pour le
 * prochain cycle complet (`syncQueue` rappelé plus tard, retentée depuis le
 * début) ; au seuil, elle bascule en échec définitif
 * (`markMutationPermanentlyFailed`) vers l'interface de résolution, exactement
 * comme `PermanentValidationError`, avec un message qui la distingue
 * explicitement d'une erreur de validation.
 */
export async function syncQueue(deps: {
  tenantId: string;
  syncTransport: SyncTransport;
}): Promise<SyncQueueResult> {
  const pending = await listPendingMutations(deps.tenantId);
  let succeeded = 0;
  const deferred: MutationQueueRecord[] = [];

  for (const record of pending) {
    try {
      await attemptMutation(deps.syncTransport, record);
      succeeded += 1;
    } catch (error) {
      if (error instanceof DependencyPendingError) {
        deferred.push(record);
        continue;
      }
      if (error instanceof PermanentValidationError) {
        await markMutationPermanentlyFailed(record.id, error.message);
        continue;
      }
      return handleBlockingFailure(deps.tenantId, record, error, succeeded);
    }
  }

  // Second passage : une seule retentative par mutation reportée, maintenant
  // que le reste de ce cycle (potentiellement sa dépendance) a été traité.
  for (const record of deferred) {
    try {
      await attemptMutation(deps.syncTransport, record);
      succeeded += 1;
    } catch (error) {
      if (error instanceof DependencyPendingError) {
        // Toujours introuvable après avoir laissé sa chance au reste du
        // cycle : incrémente le compteur de cycles consécutifs. En dessous
        // du seuil, reste simplement en attente pour le prochain cycle
        // complet ; au seuil, bascule en échec définitif vers l'interface
        // de résolution (sync-failures-panel.tsx lit `syncError` tel quel).
        const updated = await incrementDependencyDeferral(record.id, error.message);
        if ((updated?.dependencyDeferredCycles ?? 0) >= MAX_DEPENDENCY_DEFER_CYCLES) {
          await markMutationPermanentlyFailed(
            record.id,
            "En attente d'une autre donnée non encore synchronisée",
          );
        }
        continue;
      }
      if (error instanceof PermanentValidationError) {
        await markMutationPermanentlyFailed(record.id, error.message);
        continue;
      }
      return handleBlockingFailure(deps.tenantId, record, error, succeeded);
    }
  }

  const remaining = (await listPendingMutations(deps.tenantId)).length;
  return { succeeded, remaining, failed: remaining > 0 };
}
