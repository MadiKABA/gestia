import type {
  MutationHandler,
  MutationHandlerResult,
} from "@/application/offline/mutation-handler";
import type { PaymentInput } from "@/domain/payment/payment.entity";
import { ValidationError } from "@/domain/shared/errors";
import { registerPayment } from "@/application/payment/register-payment.use-case";
import { PrismaTransactionRepository } from "@/infrastructure/transaction/transaction.repository";
import { PrismaPaymentRepository } from "@/infrastructure/payment/payment.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";

const auditLogger = new PrismaAuditLogger();

/**
 * Cible serveur réelle des mutations Payment synchronisées — appelée
 * uniquement par le moteur de sync générique. `update`/`delete` ne sont
 * jamais dispatchés en pratique : PaymentOfflineRepository n'expose que
 * `create` (un paiement n'est jamais modifié ni supprimé), mais
 * `MutationHandler` impose les trois méthodes — elles échouent
 * explicitement si un jour appelées plutôt que de silencieusement no-op.
 */
export const paymentMutationHandler: MutationHandler<PaymentInput> = {
  async create(context, clientGeneratedId, payload): Promise<MutationHandlerResult> {
    const paymentRepository = new PrismaPaymentRepository(context.tenantId);

    // Check-then-create : un retry réseau ne doit jamais recalculer et
    // réappliquer le paiement une deuxième fois (contrairement à Party, ici
    // un double-create incrémenterait deux fois Transaction.paidAmount) —
    // même précaution que transactionMutationHandler.create, encore plus
    // nécessaire ici. Le catch P2002 reste le filet de sécurité pour la
    // vraie race entre deux retries concurrents.
    const existing = await paymentRepository.findById(clientGeneratedId);
    if (existing) return { updatedAt: existing.createdAt.toISOString() };

    try {
      const transactionRepository = new PrismaTransactionRepository(context.tenantId);
      const result = await registerPayment(
        context,
        { transactionRepository, paymentRepository, auditLogger },
        clientGeneratedId,
        payload,
      );
      return { updatedAt: result.payment.createdAt.toISOString() };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        const retried = await paymentRepository.findById(clientGeneratedId);
        if (retried) return { updatedAt: retried.createdAt.toISOString() };
      }
      throw error;
    }
  },

  async update(): Promise<MutationHandlerResult> {
    throw new ValidationError("Un paiement ne peut jamais être modifié");
  },

  async delete(): Promise<MutationHandlerResult> {
    throw new ValidationError("Un paiement ne peut jamais être supprimé");
  },
};
