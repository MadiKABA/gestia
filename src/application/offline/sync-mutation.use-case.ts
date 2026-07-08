import type { TenantContext } from "@/domain/shared/tenant-context";
import { ValidationError } from "@/domain/shared/errors";
import type { AuditLogger } from "@/application/shared/audit-logger";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import { getMutationHandler } from "@/application/offline/mutation-handler-registry";
import { getMutationSchema } from "@/application/offline/mutation-schema-registry";

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

  const payload = validatePayload(mutation);

  const result = await (() => {
    switch (mutation.action) {
      case "create":
        return handler.create(context, mutation.clientGeneratedId, payload);
      case "update":
        return handler.update(
          context,
          mutation.clientGeneratedId,
          payload,
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
      newData: payload,
    });
  }

  return { updatedAt: result.updatedAt, conflict: Boolean(result.conflict) };
}

/**
 * Valide `mutation.payload` avec le schéma Zod enregistré pour cette entity
 * (mutation-schema-registry.ts), s'il en existe un — un `delete` n'a pas de
 * payload à valider. Une entity sans schéma enregistré n'est pas bloquée
 * (rétrocompatible avec les gestionnaires de test qui n'en ont pas besoin),
 * mais toute entity qui EN enregistre un voit son payload rejeté proprement
 * (ValidationError, jamais une erreur Prisma brute qui remonterait au
 * client) avant tout accès au gestionnaire métier. Retourne la valeur
 * validée par Zod (trim/valeurs par défaut appliqués), pas le payload brut.
 */
function validatePayload(mutation: QueuedMutation): unknown {
  if (mutation.action === "delete") return mutation.payload;

  const schema = getMutationSchema(mutation.entity);
  if (!schema) return mutation.payload;

  const parsed = schema.safeParse(mutation.payload);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join(", ");
    throw new ValidationError(`Payload invalide pour la mutation "${mutation.entity}": ${details}`);
  }
  return parsed.data;
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
