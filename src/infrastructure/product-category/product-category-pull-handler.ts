import {
  PULL_PAGE_SIZE,
  type PullHandler,
  type PulledRecord,
} from "@/application/offline/pull-handler";
import type { ProductCategory } from "@/domain/product-category/product-category.entity";
import {
  PrismaProductCategoryRepository,
  toDomainProductCategory,
} from "@/infrastructure/product-category/product-category.repository";

type Cursor = { updatedAt: string; id: string };

function decodeCursor(pageCursor: string): Cursor {
  return JSON.parse(pageCursor) as Cursor;
}

function encodeCursor(cursor: Cursor): string {
  return JSON.stringify(cursor);
}

export const productCategoryPullHandler: PullHandler<ProductCategory> = {
  async findChangedSince(context, since, queryStartedAt, pageCursor) {
    const repository = new PrismaProductCategoryRepository(context.tenantId);
    const cursor = pageCursor ? decodeCursor(pageCursor) : undefined;

    const rows = await repository.findChangedSince(
      since,
      queryStartedAt,
      cursor ? { updatedAt: new Date(cursor.updatedAt), id: cursor.id } : undefined,
      PULL_PAGE_SIZE + 1,
    );

    const hasMore = rows.length > PULL_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PULL_PAGE_SIZE) : rows;

    const records: PulledRecord<ProductCategory>[] = page.map((row) => ({
      id: row.id,
      // Pas de colonne `updatedAt` sur ProductCategory (jamais modifiée
      // après création) : `createdAt` sert de substitut, seul horodatage
      // disponible — voir PrismaProductCategoryRepository.findChangedSince.
      updatedAt: row.createdAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      data: toDomainProductCategory(row),
    }));

    const last = page.at(-1);
    return {
      records,
      nextPageCursor:
        hasMore && last
          ? encodeCursor({ updatedAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  },
};
