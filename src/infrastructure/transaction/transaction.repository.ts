import type { Transaction as TransactionRow } from "@/generated/prisma/client";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import type {
  Transaction,
  TransactionInput,
  TransactionUpdateInput,
} from "@/domain/transaction/transaction.entity";
import {
  deriveTransactionStatus,
  formatReference,
  transactionBalanceContribution,
} from "@/domain/transaction/transaction.entity";
import type {
  TransactionRepository,
  TransactionSearchQuery,
} from "@/application/transaction/transaction.repository";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

const OPEN_STATUSES = ["EN_COURS", "PARTIELLE"] as const;

/** Conversion Decimal → number, seule frontière du repository (jamais dans
 * domain/application/presentation) — voir CLAUDE.md "Montants en Decimal".
 * Exportée (pas une méthode privée de la classe) pour que
 * transaction-pull-handler.ts la réutilise sans dupliquer la règle. */
export function toDomainTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    tenantId: row.tenantId,
    reference: row.reference,
    partyId: row.partyId,
    type: row.type,
    description: row.description,
    quantity: row.quantity,
    amount: row.amount.toNumber(),
    paidAmount: row.paidAmount.toNumber(),
    dueDate: row.dueDate,
    status: row.status,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaTransactionRepository
  extends TenantScopedRepository
  implements TransactionRepository
{
  async findById(id: string): Promise<Transaction | null> {
    const row = await this.prisma.transaction.findFirst({
      where: this.scoped({ id, deletedAt: null }),
    });
    return row ? toDomainTransaction(row) : null;
  }

  async findMany(query: TransactionSearchQuery): Promise<Transaction[]> {
    const rows = await this.prisma.transaction.findMany({
      where: this.scoped({
        deletedAt: null,
        ...(query.partyId ? { partyId: query.partyId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? { description: { contains: query.search, mode: "insensitive" as const } }
          : {}),
      }),
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomainTransaction);
  }

  async findByParty(partyId: string): Promise<Transaction[]> {
    return this.findMany({ partyId });
  }

  /**
   * Réservé au PullHandler (infrastructure/transaction/transaction-pull-handler.ts)
   * — inclut volontairement les lignes soft-deleted, même contrat que
   * PrismaPartyRepository.findChangedSince. Retourne les lignes brutes
   * (Decimal non converti) : le pull handler applique `toDomainTransaction`
   * lui-même, exactement comme cette classe le fait pour ses propres lectures.
   */
  async findChangedSince(
    since: Date,
    queryStartedAt: Date,
    cursor: { updatedAt: Date; id: string } | undefined,
    take: number,
  ) {
    return this.prisma.transaction.findMany({
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
   * Génère la référence métier (CR-2026-00125 / DT-2026-00045) via un
   * compteur atomique par tenant/année (`Sequence`) et crée la ligne
   * Transaction dans la même transaction Prisma — l'`upsert` ciblant la
   * contrainte unique `tenantId_year` compile en `INSERT ... ON CONFLICT
   * DO UPDATE` natif Postgres (incrément atomique, pas de lecture-puis-
   * écriture en JS), donc sans risque de collision de référence entre deux
   * créations concurrentes du même tenant/année.
   */
  async create(id: string, input: TransactionInput, createdById: string): Promise<Transaction> {
    const year = new Date().getFullYear();

    const row = await this.prisma.$transaction(async (tx) => {
      const sequence = await tx.sequence.upsert({
        where: { tenantId_year: { tenantId: this.tenantId, year } },
        create: {
          tenantId: this.tenantId,
          year,
          creditCounter: input.type === "CREANCE" ? 1 : 0,
          debtCounter: input.type === "DETTE" ? 1 : 0,
        },
        update:
          input.type === "CREANCE"
            ? { creditCounter: { increment: 1 } }
            : { debtCounter: { increment: 1 } },
      });
      const counter = input.type === "CREANCE" ? sequence.creditCounter : sequence.debtCounter;

      return tx.transaction.create({
        data: {
          id,
          tenantId: this.tenantId,
          reference: formatReference(input.type, year, counter),
          partyId: input.partyId,
          type: input.type,
          description: input.description,
          quantity: input.quantity ?? null,
          amount: new Decimal(input.amount),
          paidAmount: new Decimal(0),
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          status: "EN_COURS",
          createdById,
        },
      });
    });

    return toDomainTransaction(row);
  }

  /**
   * `paidAmount` n'est jamais éditable ici (aucun champ dans
   * TransactionUpdateInput, module Payment hors périmètre) — relu depuis la
   * ligne courante pour dériver `status` correctement si `amount` change
   * sur une transaction déjà partiellement payée. Toujours EN_COURS en
   * pratique aujourd'hui (paidAmount reste à 0), mais correct par
   * construction pour quand Payment existera.
   */
  async update(id: string, input: TransactionUpdateInput): Promise<Transaction> {
    const current = await this.prisma.transaction.findFirstOrThrow({
      where: this.scoped({ id }),
    });

    const row = await this.prisma.transaction.update({
      where: this.scoped({ id }),
      data: {
        type: input.type,
        description: input.description,
        quantity: input.quantity ?? null,
        amount: new Decimal(input.amount),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: deriveTransactionStatus(input.amount, current.paidAmount.toNumber()),
      },
    });
    return toDomainTransaction(row);
  }

  async delete(id: string): Promise<Transaction> {
    const row = await this.prisma.transaction.update({
      where: this.scoped({ id }),
      data: { deletedAt: new Date() },
    });
    return toDomainTransaction(row);
  }

  async hasOpenTransactionsForParty(partyId: string): Promise<boolean> {
    const count = await this.prisma.transaction.count({
      where: this.scoped({ partyId, deletedAt: null, status: { in: [...OPEN_STATUSES] } }),
    });
    return count > 0;
  }

  /**
   * Agrégation SQL du solde net par tiers (cahier des charges §7) — un seul
   * `groupBy` pour tous les `partyIds` demandés plutôt qu'une requête par
   * tiers. Le signe (CREANCE positif, DETTE négatif) est appliqué en JS via
   * `transactionBalanceContribution`, jamais dupliqué en SQL brut : la même
   * fonction domain gouverne ce calcul agrégé ET le recalcul détaillé de
   * get-party-by-id.use-case.ts (computePartyBalance sur la liste complète).
   */
  async aggregateBalancesByParty(partyIds: string[]): Promise<Map<string, number>> {
    const balances = new Map<string, number>();
    if (partyIds.length === 0) return balances;

    const groups = await this.prisma.transaction.groupBy({
      by: ["partyId", "type"],
      where: this.scoped({ partyId: { in: partyIds }, deletedAt: null }),
      _sum: { amount: true, paidAmount: true },
    });

    for (const group of groups) {
      const amount = group._sum.amount?.toNumber() ?? 0;
      const paidAmount = group._sum.paidAmount?.toNumber() ?? 0;
      const contribution = transactionBalanceContribution(group.type, amount, paidAmount);
      balances.set(group.partyId, (balances.get(group.partyId) ?? 0) + contribution);
    }

    return balances;
  }
}
