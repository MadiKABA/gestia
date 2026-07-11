import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncMutationResult } from "@/application/offline/sync-mutation.use-case";
import type { SyncActionResult, SyncFailureReason } from "@/application/offline/sync-result";
import {
  listPendingMutations,
  markMutationFailed,
  markMutationPermanentlyFailed,
  markMutationSynced,
} from "@/infrastructure/offline/mutation-queue.store";
import { getCachedEntity, setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { AuthRequiredError, PermanentValidationError } from "@/infrastructure/offline/errors";

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

/** Backoff simple, plafonné — pas de plafond de tentatives : une mutation
 * n'est jamais abandonnée (cahier des charges §9), seulement retentée de
 * moins en moins souvent. */
export function computeBackoffDelayMs(retryCount: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** retryCount, MAX_RETRY_DELAY_MS);
}

/**
 * Rejoue les mutations en attente d'un tenant, dans l'ordre chronologique,
 * une par une (jamais en parallèle — l'ordre doit être respecté). S'arrête
 * à la première erreur *transitoire* (réseau, serveur indisponible,
 * session expirée) plutôt que de la sauter : sauter casserait l'ordre pour
 * les mutations suivantes sur la même entité, alors qu'un prochain cycle
 * peut la faire réussir.
 *
 * Une erreur de validation métier *définitive* (`PermanentValidationError`,
 * ex. "montant supérieur au solde restant") suit une règle différente : ce
 * payload ne deviendra jamais valide en le renvoyant tel quel, donc son
 * sort ne dépend plus d'aucune tentative future — elle est retirée de la
 * queue de retry (`markMutationPermanentlyFailed`, voir
 * mutation-queue.store.ts) et la boucle continue avec les mutations
 * suivantes dans le même passage, sans casser leur ordre (voir
 * presentation/offline/components/sync-failures-panel.tsx pour la
 * résolution manuelle qui en découle).
 */
export async function syncQueue(deps: {
  tenantId: string;
  syncTransport: SyncTransport;
}): Promise<SyncQueueResult> {
  const pending = await listPendingMutations(deps.tenantId);
  let succeeded = 0;

  for (const record of pending) {
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
      const cached = await getCachedEntity(
        record.tenantId,
        record.entity,
        record.clientGeneratedId,
      );
      mutation.clientKnownUpdatedAt = cached?.updatedAt;
    } else if (record.action === "delete") {
      // Le cache local a déjà été retiré à l'enfilement (affichage
      // instantané) — la seule valeur disponible est celle figée alors.
      mutation.clientKnownUpdatedAt = record.clientKnownUpdatedAt;
    }

    try {
      const outcome = await deps.syncTransport(mutation);
      if (!outcome.ok) {
        // "rate_limited" tombe dans le catch générique ci-dessous (backoff
        // exponentiel classique, comme une coupure réseau) — "auth_required"
        // et "validation_error" ont chacun un traitement dédié, voir plus bas.
        throw outcome.reason === "auth_required"
          ? new AuthRequiredError()
          : outcome.reason === "validation_error"
            ? new PermanentValidationError(outcome.message)
            : new Error("Trop de synchronisations récentes, nouvelle tentative différée");
      }
      const result = outcome.data;

      await markMutationSynced(record.id, new Date().toISOString());
      succeeded += 1;

      if (record.action !== "delete") {
        const cached = await getCachedEntity(
          record.tenantId,
          record.entity,
          record.clientGeneratedId,
        );
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
    } catch (error) {
      if (error instanceof PermanentValidationError) {
        // Définitif : plus jamais retentée automatiquement (voir
        // markMutationPermanentlyFailed, qui l'exclut de
        // listPendingMutations), mais son sort est scellé — contrairement à
        // une erreur transitoire, rien n'empêche de continuer avec les
        // mutations suivantes dans ce même passage.
        await markMutationPermanentlyFailed(record.id, error.message);
        continue;
      }

      const remaining = (await listPendingMutations(deps.tenantId)).length;

      if (error instanceof AuthRequiredError) {
        // Ni marquée échouée ni synced : la mutation reste intacte, sans
        // backoff — retenter immédiatement n'a aucun sens tant que la
        // session n'est pas renouvelée (voir network-status-store.ts, qui
        // redirige vers /login sur cette raison plutôt que de planifier une
        // nouvelle tentative).
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
  }

  return { succeeded, remaining: 0, failed: false };
}
