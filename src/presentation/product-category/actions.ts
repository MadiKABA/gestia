"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import { requirePatron } from "@/presentation/auth/require-role";
import { searchProductCategories } from "@/application/product-category/search-product-categories.use-case";
import { PrismaProductCategoryRepository } from "@/infrastructure/product-category/product-category.repository";
import { PrismaProductRepository } from "@/infrastructure/product/product.repository";
import type { ProductCategoryRow } from "@/presentation/product-category/components/product-categories-panel";

/** Lecture seule — mêmes règles que product/actions.ts (les écritures
 * passent par ProductCategoryOfflineRepository). */
export async function searchProductCategoriesAction() {
  const context = await requireTenantContext();
  const repository = new PrismaProductCategoryRepository(context.tenantId);
  return searchProductCategories({ repository }, {});
}

/**
 * Compose ProductCategory et Product (lecture seule) pour la page de
 * gestion des catégories — cette composition n'a pas sa place dans
 * `application/product-category` (jamais de dépendance croisée vers
 * `application/product`, cf. delete-product-category.use-case.ts), donc
 * assemblée ici, au niveau presentation.
 */
export async function listProductCategoriesWithCountsAction(): Promise<ProductCategoryRow[]> {
  const context = await requirePatron();
  const categoryRepository = new PrismaProductCategoryRepository(context.tenantId);
  const productRepository = new PrismaProductRepository(context.tenantId);

  const categories = await searchProductCategories({ repository: categoryRepository }, {});
  const counts = await productRepository.countActiveByCategoryIds(
    categories.map((category) => category.id),
  );

  return categories.map((category) => ({
    ...category,
    productCount: counts.get(category.id) ?? 0,
  }));
}
