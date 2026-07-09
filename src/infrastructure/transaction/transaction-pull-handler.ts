import {
  PULL_PAGE_SIZE,
  type PullHandler,
  type PulledRecord,
} from "@/application/offline/pull-handler";
import type { Transaction } from "@/domain/transaction/transaction.entity";
import {
  PrismaTransactionRepository,
  toDomainTransaction,
} from "@/infrastructure/transaction/transaction.repository";

type Cursor = { updatedAt: string; id: string };

function decodeCursor(pageCursor: string): Cursor {
  return JSON.parse(pageCursor) as Cursor;
}

function encodeCursor(cursor: Cursor): string {
  return JSON.stringify(cursor);
}

/**
 * Gestionnaire de pull de production pour Transaction, même pattern que
 * party-pull-handler.ts. `toDomainTransaction` (Decimal → number) est
 * appliqué ici comme pour toute lecture — c'est aussi ce pull qui rapatrie
 * la vraie `reference` (générée server-side, absente de l'objet optimiste
 * local, voir transaction-offline.repository.ts).
 */
export const transactionPullHandler: PullHandler<Transaction> = {
  async findChangedSince(context, since, queryStartedAt, pageCursor) {
    const repository = new PrismaTransactionRepository(context.tenantId);
    const cursor = pageCursor ? decodeCursor(pageCursor) : undefined;

    const rows = await repository.findChangedSince(
      since,
      queryStartedAt,
      cursor ? { updatedAt: new Date(cursor.updatedAt), id: cursor.id } : undefined,
      PULL_PAGE_SIZE + 1,
    );

    const hasMore = rows.length > PULL_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PULL_PAGE_SIZE) : rows;

    const records: PulledRecord<Transaction>[] = page.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      data: toDomainTransaction(row),
    }));

    const last = page.at(-1);
    return {
      records,
      nextPageCursor:
        hasMore && last
          ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
          : undefined,
    };
  },
};
