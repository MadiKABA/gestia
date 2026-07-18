import type {
  ProductCategory,
  ProductCategoryInput,
} from "@/domain/product-category/product-category.entity";

export type ProductCategorySearchQuery = { search?: string };

/**
 * Contrat implémenté par
 * src/infrastructure/product-category/product-category.repository.ts.
 */
export interface ProductCategoryRepository {
  findById(id: string): Promise<ProductCategory | null>;
  findMany(query: ProductCategorySearchQuery): Promise<ProductCategory[]>;
  create(id: string, input: ProductCategoryInput): Promise<ProductCategory>;
  update(id: string, input: ProductCategoryInput): Promise<ProductCategory>;
  /** Soft delete (`deletedAt`) — jamais de suppression définitive. */
  delete(id: string): Promise<ProductCategory>;
}
