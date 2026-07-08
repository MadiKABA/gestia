import {
  PULL_PAGE_SIZE,
  type PullHandler,
  type PulledRecord,
} from "@/application/offline/pull-handler";
import type { PartyWithBalance } from "@/application/party/party.repository";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";

type Cursor = { updatedAt: string; id: string };

function decodeCursor(pageCursor: string): Cursor {
  return JSON.parse(pageCursor) as Cursor;
}

function encodeCursor(cursor: Cursor): string {
  return JSON.stringify(cursor);
}

/**
 * Gestionnaire de pull de production pour Party (retrofit du module sur la
 * couche de synchronisation descendante générique, cf. CLAUDE.md). Même
 * limitation assumée que `PrismaPartyRepository.findMany` : `balance` reste
 * à 0 tant que le module Transaction n'existe pas.
 */
export const partyPullHandler: PullHandler<PartyWithBalance> = {
  async findChangedSince(context, since, queryStartedAt, pageCursor) {
    const repository = new PrismaPartyRepository(context.tenantId);
    const cursor = pageCursor ? decodeCursor(pageCursor) : undefined;

    const rows = await repository.findChangedSince(
      since,
      queryStartedAt,
      cursor ? { updatedAt: new Date(cursor.updatedAt), id: cursor.id } : undefined,
      PULL_PAGE_SIZE + 1,
    );

    const hasMore = rows.length > PULL_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PULL_PAGE_SIZE) : rows;

    const records: PulledRecord<PartyWithBalance>[] = page.map((party) => ({
      id: party.id,
      updatedAt: party.updatedAt.toISOString(),
      deletedAt: party.deletedAt?.toISOString() ?? null,
      // TODO: brancher le calcul réel une fois le module Transaction
      // implémenté (même limitation que PrismaPartyRepository.findMany).
      data: { ...party, balance: 0 },
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
