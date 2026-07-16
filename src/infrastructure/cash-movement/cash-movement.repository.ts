import type { CashMovement as CashMovementRow } from "@/generated/prisma/client";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import type { CashMovement, CashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import type {
  CashBalance,
  CashMovementListQuery,
  CashMovementListResult,
  CashMovementRepository,
} from "@/application/cash-movement/cash-movement.repository";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

/** Conversion Decimal → number, seule frontière du repository — voir
 * infrastructure/transaction/transaction.repository.ts:toDomainTransaction. */
export function toDomainCashMovement(row: CashMovementRow): CashMovement {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    amount: row.amount.toNumber(),
    reason: row.reason,
    linkedPaymentId: row.linkedPaymentId,
    partyId: row.partyId,
    method: row.method,
    createdById: row.createdById,
    date: row.date,
  };
}

export class PrismaCashMovementRepository
  extends TenantScopedRepository
  implements CashMovementRepository
{
  async findById(id: string): Promise<CashMovement | null> {
    const row = await this.prisma.cashMovement.findFirst({
      where: this.scoped({ id, deletedAt: null }),
    });
    return row ? toDomainCashMovement(row) : null;
  }

  async findMany(query: CashMovementListQuery): Promise<CashMovementListResult> {
    const where = this.scoped({ deletedAt: null });
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: query.pageSize,
      }),
      this.prisma.cashMovement.count({ where }),
    ]);

    return {
      items: rows.map(toDomainCashMovement),
      total,
      hasMore: skip + rows.length < total,
    };
  }

  async create(id: string, input: CashMovementInput, createdById: string): Promise<CashMovement> {
    const row = await this.prisma.cashMovement.create({
      data: {
        id,
        tenantId: this.tenantId,
        type: input.type,
        amount: new Decimal(input.amount),
        reason: input.reason,
        partyId: input.partyId ?? null,
        method: input.method ?? null,
        createdById,
      },
    });
    return toDomainCashMovement(row);
  }

  async getBalance(): Promise<CashBalance> {
    const groups = await this.prisma.cashMovement.groupBy({
      by: ["type"],
      where: this.scoped({ deletedAt: null }),
      _sum: { amount: true },
    });

    let totalEntree = 0;
    let totalSortie = 0;
    for (const group of groups) {
      const amount = group._sum.amount?.toNumber() ?? 0;
      if (group.type === "ENTREE") totalEntree = amount;
      else totalSortie = amount;
    }

    return { totalEntree, totalSortie };
  }

  /**
   * Réservé au PullHandler (infrastructure/cash-movement/cash-movement-pull-handler.ts)
   * — même contrat que PrismaPaymentRepository.findChangedSince (lignes brutes,
   * soft-deleted incluses, toDomainCashMovement appliqué par l'appelant).
   */
  async findChangedSince(
    since: Date,
    queryStartedAt: Date,
    cursor: { updatedAt: Date; id: string } | undefined,
    take: number,
  ) {
    return this.prisma.cashMovement.findMany({
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
}
