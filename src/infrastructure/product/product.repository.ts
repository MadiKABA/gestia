import type { Product as ProductRow } from "@/generated/prisma/client";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";
import type { Product } from "@/domain/product/product.entity";
import type {
  ProductRepository,
  ProductSearchQuery,
  ResolvedProductInput,
} from "@/application/product/product.repository";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

/** Conversion Decimal → number, seule frontière du repository (jamais dans
 * domain/application/presentation) — voir CLAUDE.md "Montants en Decimal".
 * Exportée pour que product-pull-handler.ts la réutilise sans dupliquer la
 * règle (même pattern que toDomainTransaction). */
export function toDomainProduct(row: ProductRow): Product {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    type: row.type,
    purchasePrice: row.purchasePrice?.toNumber() ?? null,
    sellingPrice: row.sellingPrice.toNumber(),
    unit: row.unit,
    trackStock: row.trackStock,
    stockQuantity: row.stockQuantity?.toNumber() ?? null,
    barcode: row.barcode,
    photoUrl: row.photoUrl,
    categoryId: row.categoryId,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaProductRepository extends TenantScopedRepository implements ProductRepository {
  async findById(id: string): Promise<Product | null> {
    const row = await this.prisma.product.findFirst({
      where: this.scoped({ id, deletedAt: null }),
    });
    return row ? toDomainProduct(row) : null;
  }

  async findMany(query: ProductSearchQuery): Promise<Product[]> {
    const rows = await this.prisma.product.findMany({
      where: this.scoped({
        deletedAt: null,
        ...(query.type ? { type: query.type } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" as const } },
                { barcode: { contains: query.search } },
              ],
            }
          : {}),
      }),
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomainProduct);
  }

  /** Réservé au PullHandler de synchronisation descendante — mêmes règles
   * que PrismaPartyRepository.findChangedSince (curseur stable, inclut les
   * lignes soft-deleted). */
  async findChangedSince(
    since: Date,
    queryStartedAt: Date,
    cursor: { updatedAt: Date; id: string } | undefined,
    take: number,
  ) {
    return this.prisma.product.findMany({
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

  async create(id: string, input: ResolvedProductInput, createdById: string): Promise<Product> {
    const row = await this.prisma.product.create({
      data: {
        id,
        tenantId: this.tenantId,
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        purchasePrice: input.purchasePrice != null ? new Decimal(input.purchasePrice) : null,
        sellingPrice: new Decimal(input.sellingPrice),
        unit: input.unit ?? null,
        trackStock: input.trackStock ?? false,
        stockQuantity: input.stockQuantity != null ? new Decimal(input.stockQuantity) : null,
        barcode: input.barcode ?? null,
        photoUrl: input.photoUrl ?? null,
        categoryId: input.categoryId ?? null,
        createdById,
      },
    });
    return toDomainProduct(row);
  }

  async update(id: string, input: ResolvedProductInput): Promise<Product> {
    const row = await this.prisma.product.update({
      where: this.scoped({ id }),
      data: {
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        purchasePrice: input.purchasePrice != null ? new Decimal(input.purchasePrice) : null,
        sellingPrice: new Decimal(input.sellingPrice),
        unit: input.unit ?? null,
        trackStock: input.trackStock ?? false,
        stockQuantity: input.stockQuantity != null ? new Decimal(input.stockQuantity) : null,
        barcode: input.barcode ?? null,
        categoryId: input.categoryId ?? null,
        // `photoUrl` absent (`undefined`) : Prisma ignore le champ, valeur
        // existante inchangée — c'est la sémantique voulue (pas de nouvelle
        // photo sélectionnée), jamais un "undefined" écrit tel quel.
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
      },
    });
    return toDomainProduct(row);
  }

  async delete(id: string): Promise<Product> {
    const row = await this.prisma.product.update({
      where: this.scoped({ id }),
      data: { deletedAt: new Date() },
    });
    return toDomainProduct(row);
  }
}
