import {
  PULL_PAGE_SIZE,
  type PullHandler,
  type PulledRecord,
} from "@/application/offline/pull-handler";
import type { Payment } from "@/domain/payment/payment.entity";
import {
  PrismaPaymentRepository,
  toDomainPayment,
} from "@/infrastructure/payment/payment.repository";

type Cursor = { updatedAt: string; id: string };

function decodeCursor(pageCursor: string): Cursor {
  return JSON.parse(pageCursor) as Cursor;
}

function encodeCursor(cursor: Cursor): string {
  return JSON.stringify(cursor);
}

/**
 * Gestionnaire de pull de production pour Payment, même pattern que
 * transaction-pull-handler.ts. C'est aussi ce pull qui répercute, côté
 * client, la mise à jour de Transaction.paidAmount/status faite par
 * register-payment.use-case.ts — via le pull "transaction" déjà existant,
 * jamais dupliqué ici.
 */
export const paymentPullHandler: PullHandler<Payment> = {
  async findChangedSince(context, since, queryStartedAt, pageCursor) {
    const repository = new PrismaPaymentRepository(context.tenantId);
    const cursor = pageCursor ? decodeCursor(pageCursor) : undefined;

    const rows = await repository.findChangedSince(
      since,
      queryStartedAt,
      cursor ? { updatedAt: new Date(cursor.updatedAt), id: cursor.id } : undefined,
      PULL_PAGE_SIZE + 1,
    );

    const hasMore = rows.length > PULL_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PULL_PAGE_SIZE) : rows;

    const records: PulledRecord<Payment>[] = page.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      data: toDomainPayment(row),
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
