import type { Payment as PaymentRow } from "@/generated/prisma/client";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import type { Payment } from "@/domain/payment/payment.entity";
import type {
  PaymentRegistrationInput,
  PaymentRegistrationResult,
  PaymentRepository,
} from "@/application/payment/payment.repository";
import { toDomainTransaction } from "@/infrastructure/transaction/transaction.repository";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

/** Conversion Decimal → number, seule frontière du repository — voir
 * infrastructure/transaction/transaction.repository.ts:toDomainTransaction. */
export function toDomainPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    transactionId: row.transactionId,
    amount: row.amount.toNumber(),
    method: row.method,
    direction: row.direction,
    note: row.note,
    createdById: row.createdById,
    createdAt: row.createdAt,
  };
}

export class PrismaPaymentRepository extends TenantScopedRepository implements PaymentRepository {
  async findById(id: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findFirst({
      where: this.scoped({ id, deletedAt: null }),
    });
    return row ? toDomainPayment(row) : null;
  }

  async findByTransactionId(transactionId: string): Promise<Payment[]> {
    const rows = await this.prisma.payment.findMany({
      where: this.scoped({ transactionId, deletedAt: null }),
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomainPayment);
  }

  /**
   * Une seule requête triée `createdAt desc`, réduite en JS en ne gardant
   * que la première occurrence par transaction (donc la plus récente) —
   * même esprit que PrismaTransactionRepository.aggregateBalancesByParty
   * (agrégation batchée plutôt qu'une requête par ligne affichée).
   */
  async findLatestByTransactionIds(transactionIds: string[]): Promise<Map<string, Payment>> {
    const latest = new Map<string, Payment>();
    if (transactionIds.length === 0) return latest;

    const rows = await this.prisma.payment.findMany({
      where: this.scoped({ transactionId: { in: transactionIds }, deletedAt: null }),
      orderBy: { createdAt: "desc" },
    });

    for (const row of rows) {
      if (!latest.has(row.transactionId)) {
        latest.set(row.transactionId, toDomainPayment(row));
      }
    }
    return latest;
  }

  /**
   * Réservé au PullHandler (infrastructure/payment/payment-pull-handler.ts)
   * — même contrat que PrismaTransactionRepository.findChangedSince (lignes
   * brutes, soft-deleted incluses, `toDomainPayment` appliqué par l'appelant).
   */
  async findChangedSince(
    since: Date,
    queryStartedAt: Date,
    cursor: { updatedAt: Date; id: string } | undefined,
    take: number,
  ) {
    return this.prisma.payment.findMany({
      where: this.scoped({
        updatedAt: { gt: since, lte: queryStartedAt },
        ...(cursor
          ? {
              OR: [
                { updatedAt: { gt: cursor.updatedAt } },
                { updatedAt: cursor.updatedAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      }),
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take,
    });
  }

  /**
   * Écrit Payment, la mise à jour de Transaction.paidAmount/status et le
   * CashMovement (si paiement CASH) dans une seule transaction Prisma —
   * même précédent que PrismaTransactionRepository.create() (Sequence +
   * Transaction atomiques). Pas de module application/cash-movement séparé
   * pour ce retrofit : aucune page "Caisse" ne consomme encore de
   * mouvements manuels, seules les règles pures de
   * domain/cash-movement/cash-movement.entity.ts sont posées pour ce futur
   * chantier, qui devra alors extraire un vrai repository dédié.
   */
  async register(
    id: string,
    input: PaymentRegistrationInput,
    createdById: string,
  ): Promise<PaymentRegistrationResult> {
    const { paymentRow, transactionRow, cashMovementId } = await this.prisma.$transaction(
      async (tx) => {
        const paymentRow = await tx.payment.create({
          data: {
            id,
            tenantId: this.tenantId,
            transactionId: input.transactionId,
            amount: new Decimal(input.amount),
            method: input.method,
            direction: input.direction,
            note: input.note,
            createdById,
          },
        });

        const transactionRow = await tx.transaction.update({
          where: this.scoped({ id: input.transactionId }),
          data: {
            paidAmount: new Decimal(input.newPaidAmount),
            status: input.newStatus,
          },
        });

        let cashMovementId: string | null = null;
        if (input.cashMovement) {
          const cashMovementRow = await tx.cashMovement.create({
            data: {
              tenantId: this.tenantId,
              type: input.cashMovement.type,
              amount: new Decimal(input.amount),
              reason: input.cashMovement.reason,
              linkedPaymentId: paymentRow.id,
              createdById,
            },
          });
          cashMovementId = cashMovementRow.id;
        }

        return { paymentRow, transactionRow, cashMovementId };
      },
    );

    return {
      payment: toDomainPayment(paymentRow),
      transaction: toDomainTransaction(transactionRow),
      cashMovementId,
    };
  }
}
