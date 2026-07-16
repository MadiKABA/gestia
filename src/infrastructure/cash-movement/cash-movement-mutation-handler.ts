import type {
  MutationHandler,
  MutationHandlerResult,
} from "@/application/offline/mutation-handler";
import type { CashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import { ValidationError } from "@/domain/shared/errors";
import { createCashMovement } from "@/application/cash-movement/create-cash-movement.use-case";
import { PrismaCashMovementRepository } from "@/infrastructure/cash-movement/cash-movement.repository";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";

const auditLogger = new PrismaAuditLogger();

/**
 * Cible serveur réelle des mutations CashMovement synchronisées — appelée
 * uniquement par le moteur de sync générique. `update`/`delete` ne sont
 * jamais dispatchés en pratique : CashMovementOfflineRepository n'expose que
 * `create` (un mouvement de caisse n'est jamais modifié ni supprimé), mais
 * `MutationHandler` impose les trois méthodes — elles échouent explicitement
 * si un jour appelées plutôt que de silencieusement no-op (même choix que
 * paymentMutationHandler).
 */
export const cashMovementMutationHandler: MutationHandler<CashMovementInput> = {
  async create(context, clientGeneratedId, payload): Promise<MutationHandlerResult> {
    const repository = new PrismaCashMovementRepository(context.tenantId);

    // Check-then-create : un retry réseau ne doit jamais créer deux fois le
    // même mouvement de caisse — même précaution que paymentMutationHandler.create.
    const existing = await repository.findById(clientGeneratedId);
    if (existing) return { updatedAt: existing.date.toISOString() };

    try {
      const partyRepository = new PrismaPartyRepository(context.tenantId);
      const movement = await createCashMovement(
        context,
        { repository, partyRepository, auditLogger },
        clientGeneratedId,
        payload,
      );
      return { updatedAt: movement.date.toISOString() };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        const retried = await repository.findById(clientGeneratedId);
        if (retried) return { updatedAt: retried.date.toISOString() };
      }
      throw error;
    }
  },

  async update(): Promise<MutationHandlerResult> {
    throw new ValidationError("Un mouvement de caisse ne peut jamais être modifié");
  },

  async delete(): Promise<MutationHandlerResult> {
    throw new ValidationError("Un mouvement de caisse ne peut jamais être supprimé");
  },
};
