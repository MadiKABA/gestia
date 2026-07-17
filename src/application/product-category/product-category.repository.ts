import type {
  ProductCategory,
  ProductCategoryInput,
} from "@/domain/product-category/product-category.entity";

export type ProductCategorySearchQuery = { search?: string };

/**
 * Contrat implémenté par
 * src/infrastructure/product-category/product-category.repository.ts. Pas
 * d'update/delete : la catégorie n'est modifiable/supprimable par aucun
 * parcours de cette version (seule sa création à la volée depuis le
 * formulaire produit est supportée, cf. CLAUDE.md Scope V1).
 */
export interface ProductCategoryRepository {
  findById(id: string): Promise<ProductCategory | null>;
  findMany(query: ProductCategorySearchQuery): Promise<ProductCategory[]>;
  create(id: string, input: ProductCategoryInput): Promise<ProductCategory>;
}
