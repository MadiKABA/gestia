import type {
  ConflictInfo,
  MutationHandler,
  MutationHandlerResult,
} from "@/application/offline/mutation-handler";
import type { TransactionInput } from "@/domain/transaction/transaction.entity";
import { detectConflict } from "@/domain/offline/conflict";
import { createTransaction } from "@/application/transaction/create-transaction.use-case";
import { updateTransaction } from "@/application/transaction/update-transaction.use-case";
import { deleteTransaction } from "@/application/transaction/delete-transaction.use-case";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";

const auditLogger = new PrismaAuditLogger();

/**
 * Cible serveur réelle des mutations Transaction synchronisées — appelée
 * uniquement par le moteur de sync générique, jamais directement. Délègue
 * aux use cases application déjà existants, même AuditLog "transaction.*"
 * qu'un appel direct.
 */
export const transactionMutationHandler: MutationHandler<TransactionInput> = {
  async create(context, clientGeneratedId, payload): Promise<MutationHandlerResult> {
    const repository = new PrismaTransactionRepository(context.tenantId);

    // Check-then-create plutôt que tenter directement : contrairement à
    // Party, un create Transaction a un effet de bord stateful (incrément
    // du compteur Sequence). Sans ce filtre, chaque retry réseau normal
    // (fréquent sur ce produit offline-first) brûlerait un numéro de
    // référence supplémentaire. Le catch P2002 ci-dessous reste le filet
    // de sécurité pour la vraie race entre deux retries concurrents.
    const existing = await repository.findById(clientGeneratedId);
    if (existing) return { updatedAt: existing.updatedAt.toISOString() };

    try {
      const partyRepository = new PrismaPartyRepository(context.tenantId);
      const transaction = await createTransaction(
        context,
        { repository, partyRepository, auditLogger },
        clientGeneratedId,
        payload,
      );
      return { updatedAt: transaction.updatedAt.toISOString() };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        const retried = await repository.findById(clientGeneratedId);
        if (retried) return { updatedAt: retried.updatedAt.toISOString() };
      }
      throw error;
    }
  },

  async update(context, id, payload, clientKnownUpdatedAt): Promise<MutationHandlerResult> {
    const repository = new PrismaTransactionRepository(context.tenantId);
    const conflict = await detectTransactionConflict(repository, id, clientKnownUpdatedAt);

    // `partyId` : immuable, jamais transmis à updateTransaction (voir
    // transaction-offline.repository.ts pour pourquoi il transite quand
    // même dans le payload de mutation).
    const { partyId: _partyId, ...updateInput } = payload;
    const updated = await updateTransaction(context, { repository, auditLogger }, id, updateInput);
    return { updatedAt: updated.updatedAt.toISOString(), conflict };
  },

  async delete(context, id, clientKnownUpdatedAt): Promise<MutationHandlerResult> {
    const repository = new PrismaTransactionRepository(context.tenantId);
    const conflict = await detectTransactionConflict(repository, id, clientKnownUpdatedAt);

    const deleted = await deleteTransaction(context, { repository, auditLogger }, id);
    return { updatedAt: deleted.updatedAt.toISOString(), conflict };
  },
};

async function detectTransactionConflict(
  repository: PrismaTransactionRepository,
  id: string,
  clientKnownUpdatedAt: string,
): Promise<ConflictInfo | undefined> {
  const existing = await repository.findById(id);
  if (!existing) return undefined; // NotFoundError levée par le use case lui-même, pas un conflit.
  const serverUpdatedAtBeforeOverwrite = existing.updatedAt.toISOString();
  if (!detectConflict(clientKnownUpdatedAt, serverUpdatedAtBeforeOverwrite)) return undefined;
  return { serverValueBeforeOverwrite: existing, serverUpdatedAtBeforeOverwrite };
}
