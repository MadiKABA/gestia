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

  /** Réservé au PullHandler — même règle que les autres modules. */
  async findChangedSince(
    since: Date,
    queryStartedAt: Date,
    cursor: { updatedAt: Date; id: string } | undefined,
    take: number,
  ) {
    return this.prisma.productCategory.findMany({
      where: this.scoped({
        // ProductCategory n'a pas de colonne `updatedAt` (jamais modifiée
        // après création, cf. schema.prisma) : le pull générique s'appuie
        // donc sur `createdAt` comme borne de changement, seul horodatage
        // disponible.
        createdAt: { gt: since, lte: queryStartedAt },
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: cursor.updatedAt } },
                { createdAt: cursor.updatedAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      }),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
    });
  }

  async create(id: string, input: ProductCategoryInput): Promise<ProductCategory> {
    const row = await this.prisma.productCategory.create({
      data: { id, tenantId: this.tenantId, name: input.name },
    });
    return toDomainProductCategory(row);
  }
}
