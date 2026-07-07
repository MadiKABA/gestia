import type {
  ConflictInfo,
  MutationHandler,
  MutationHandlerResult,
} from "@/application/offline/mutation-handler";
import type { PartyInput } from "@/domain/party/party.entity";
import { detectConflict } from "@/domain/offline/conflict";
import { createParty } from "@/application/party/create-party.use-case";
import { updateParty } from "@/application/party/update-party.use-case";
import { deleteParty } from "@/application/party/delete-party.use-case";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";

const auditLogger = new PrismaAuditLogger();

/**
 * Cible serveur réelle des mutations Party synchronisées (cahier des
 * charges §9) — appelée uniquement par le moteur de sync générique
 * (application/offline/sync-mutation.use-case.ts), jamais directement par
 * une Server Action de formulaire. Délègue aux use cases createParty/
 * updateParty/deleteParty déjà existants et inchangés : mêmes règles
 * métier (permissions, validation), même AuditLog "party.created/updated/
 * deleted" — l'unique différence est le moment où cet AuditLog s'écrit
 * (à la sync, pas à l'écriture locale), jamais dupliqué.
 */
export const partyMutationHandler: MutationHandler<PartyInput> = {
  async create(context, clientGeneratedId, payload): Promise<MutationHandlerResult> {
    const repository = new PrismaPartyRepository(context.tenantId);
    try {
      const party = await createParty(
        context,
        { repository, auditLogger },
        clientGeneratedId,
        payload,
      );
      return { updatedAt: party.updatedAt.toISOString() };
    } catch (error) {
      // Rejeu retry-safe (cahier des charges §9, "aucune mutation perdue") :
      // la réponse d'une tentative précédente a pu ne jamais atteindre le
      // client (coupure réseau juste après l'écriture serveur) alors que la
      // création a bien eu lieu — le moteur de sync la retente alors avec le
      // même clientGeneratedId. La contrainte unique sur Party.id (seule
      // contrainte unique du modèle, cf. schema.prisma) ne peut être violée
      // que par exactement ce scénario, jamais par une vraie collision
      // d'id (cuid). Traiter cette tentative comme un succès plutôt que de
      // remonter l'erreur évite de bloquer la queue indéfiniment.
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await repository.findById(clientGeneratedId);
        if (existing) return { updatedAt: existing.updatedAt.toISOString() };
      }
      throw error;
    }
  },

  async update(context, id, payload, clientKnownUpdatedAt): Promise<MutationHandlerResult> {
    const repository = new PrismaPartyRepository(context.tenantId);
    const conflict = await detectPartyConflict(repository, id, clientKnownUpdatedAt);

    const updated = await updateParty(context, { repository, auditLogger }, id, payload);
    return { updatedAt: updated.updatedAt.toISOString(), conflict };
  },

  async delete(context, id, clientKnownUpdatedAt): Promise<MutationHandlerResult> {
    const repository = new PrismaPartyRepository(context.tenantId);
    const conflict = await detectPartyConflict(repository, id, clientKnownUpdatedAt);

    const deleted = await deleteParty(context, { repository, auditLogger }, id);
    return { updatedAt: deleted.updatedAt.toISOString(), conflict };
  },
};

async function detectPartyConflict(
  repository: PrismaPartyRepository,
  id: string,
  clientKnownUpdatedAt: string,
): Promise<ConflictInfo | undefined> {
  const existing = await repository.findById(id);
  if (!existing) return undefined; // NotFoundError levée par le use case lui-même, pas un conflit.
  const serverUpdatedAtBeforeOverwrite = existing.updatedAt.toISOString();
  if (!detectConflict(clientKnownUpdatedAt, serverUpdatedAtBeforeOverwrite)) return undefined;
  return { serverValueBeforeOverwrite: existing, serverUpdatedAtBeforeOverwrite };
}
