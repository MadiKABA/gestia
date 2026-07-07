import type { TenantContext } from "@/domain/shared/tenant-context";
import { ValidationError } from "@/domain/shared/errors";
import type { AuditLogger } from "@/application/shared/audit-logger";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import { getMutationHandler } from "@/application/offline/mutation-handler-registry";

export type SyncMutationResult = {
  updatedAt: string;
  conflict: boolean;
};

/**
 * Point d'entrée serveur générique du moteur de sync (appelé par
 * presentation/offline/actions.ts pour toute mutation, quel que soit
 * l'entity). Dispatch vers le gestionnaire enregistré pour `mutation.entity`
 * — ne connaît aucune règle métier lui-même. Si le gestionnaire signale un
 * conflit (dernier écrit gagne appliqué), trace une entrée AuditLog ici,
 * une seule fois, jamais dupliquée avec celle que le use case métier a pu
 * déjà écrire pour la mutation elle-même.
 */
export async function syncMutation(
  context: TenantContext,
  deps: { auditLogger: AuditLogger },
  mutation: QueuedMutation,
): Promise<SyncMutationResult> {
  const handler = getMutationHandler(mutation.entity);
  if (!handler) {
    throw new ValidationError(`Aucun gestionnaire de synchronisation pour "${mutation.entity}"`);
  }

  const result = await (() => {
    switch (mutation.action) {
      case "create":
        return handler.create(context, mutation.clientGeneratedId, mutation.payload);
      case "update":
        return handler.update(
          context,
          mutation.clientGeneratedId,
          mutation.payload,
          requireClientUpdatedAt(mutation),
        );
      case "delete":
        return handler.delete(
          context,
          mutation.clientGeneratedId,
          requireClientUpdatedAt(mutation),
        );
    }
  })();

  if (result.conflict) {
    await deps.auditLogger.log(context, {
      action: `${mutation.entity}.sync_conflict`,
      entity: mutation.entity,
      entityId: mutation.clientGeneratedId,
      oldData: result.conflict.serverValueBeforeOverwrite,
      newData: mutation.payload,
    });
  }

  return { updatedAt: result.updatedAt, conflict: Boolean(result.conflict) };
}

/**
 * `update`/`delete` doivent porter le dernier `updatedAt` connu du client
 * (transmis par le moteur de sync — voir infrastructure/offline/sync-engine.ts,
 * qui le lit depuis le cache local juste avant l'envoi) : sans lui, aucune
 * détection de conflit n'est possible.
 */
function requireClientUpdatedAt(mutation: QueuedMutation): string {
  if (!mutation.clientKnownUpdatedAt) {
    throw new ValidationError(
      `Mutation "${mutation.action}" sur "${mutation.entity}" sans clientKnownUpdatedAt`,
    );
  }
  return mutation.clientKnownUpdatedAt;
}
