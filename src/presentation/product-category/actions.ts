"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import { searchProductCategories } from "@/application/product-category/search-product-categories.use-case";
import { PrismaProductCategoryRepository } from "@/infrastructure/product-category/product-category.repository";

/** Lecture seule — mêmes règles que product/actions.ts (les écritures
 * passent par ProductCategoryOfflineRepository). */
export async function searchProductCategoriesAction() {
  const context = await requireTenantContext();
  const repository = new PrismaProductCategoryRepository(context.tenantId);
  return searchProductCategories({ repository }, {});
}
