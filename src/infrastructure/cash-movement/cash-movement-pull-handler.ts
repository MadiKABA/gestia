import {
  PULL_PAGE_SIZE,
  type PullHandler,
  type PulledRecord,
} from "@/application/offline/pull-handler";
import type { CashMovement } from "@/domain/cash-movement/cash-movement.entity";
import {
  PrismaCashMovementRepository,
  toDomainCashMovement,
} from "@/infrastructure/cash-movement/cash-movement.repository";

type Cursor = { updatedAt: string; id: string };

function decodeCursor(pageCursor: string): Cursor {
  return JSON.parse(pageCursor) as Cursor;
}

function encodeCursor(cursor: Cursor): string {
  return JSON.stringify(cursor);
}

/** Gestionnaire de pull de production pour CashMovement, même pattern que
 * payment-pull-handler.ts. */
export const cashMovementPullHandler: PullHandler<CashMovement> = {
  async findChangedSince(context, since, queryStartedAt, pageCursor) {
    const repository = new PrismaCashMovementRepository(context.tenantId);
    const cursor = pageCursor ? decodeCursor(pageCursor) : undefined;

    const rows = await repository.findChangedSince(
      since,
      queryStartedAt,
      cursor ? { updatedAt: new Date(cursor.updatedAt), id: cursor.id } : undefined,
      PULL_PAGE_SIZE + 1,
    );

    const hasMore = rows.length > PULL_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PULL_PAGE_SIZE) : rows;

    const records: PulledRecord<CashMovement>[] = page.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      data: toDomainCashMovement(row),
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
