import type { ProductCategory as ProductCategoryRow } from "@/generated/prisma/client";
import type {
  ProductCategory,
  ProductCategoryInput,
} from "@/domain/product-category/product-category.entity";
import type {
  ProductCategoryRepository,
  ProductCategorySearchQuery,
} from "@/application/product-category/product-category.repository";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

export function toDomainProductCategory(row: ProductCategoryRow): ProductCategory {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaProductCategoryRepository
  extends TenantScopedRepository
  implements ProductCategoryRepository
{
  async findById(id: string): Promise<ProductCategory | null> {
    const row = await this.prisma.productCategory.findFirst({
      where: this.scoped({ id, deletedAt: null }),
    });
    return row ? toDomainProductCategory(row) : null;
  }

  async findMany(query: ProductCategorySearchQuery): Promise<ProductCategory[]> {
    const rows = await this.prisma.productCategory.findMany({
      where: this.scoped({
        deletedAt: null,
        ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
      }),
      orderBy: { name: "asc" },
    });
    return rows.map(toDomainProductCategory);
  }

  /** Réservé au PullHandler — même pattern que
   * PrismaProductRepository.findChangedSince (curseur stable sur
   * `updatedAt`, inclut les lignes soft-deleted). */
  async findChangedSince(
    since: Date,
    queryStartedAt: Date,
    cursor: { updatedAt: Date; id: string } | undefined,
    take: number,
  ) {
    return this.prisma.productCategory.findMany({
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

  async create(id: string, input: ProductCategoryInput): Promise<ProductCategory> {
    const row = await this.prisma.productCategory.create({
      data: { id, tenantId: this.tenantId, name: input.name },
    });
    return toDomainProductCategory(row);
  }

  async update(id: string, input: ProductCategoryInput): Promise<ProductCategory> {
    const row = await this.prisma.productCategory.update({
      where: this.scoped({ id }),
      data: { name: input.name },
    });
    return toDomainProductCategory(row);
  }

  async delete(id: string): Promise<ProductCategory> {
    const row = await this.prisma.productCategory.update({
      where: this.scoped({ id }),
      data: { deletedAt: new Date() },
    });
    return toDomainProductCategory(row);
  }
}
