"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import { searchProducts } from "@/application/product/search-products.use-case";
import { PrismaProductRepository } from "@/infrastructure/product/product.repository";
import { NotFoundError } from "@/domain/shared/errors";
import { productSearchSchema, type ProductSearchInput } from "@/presentation/product/schemas";

/**
 * Lecture seule : sert de source pour le rendu serveur initial et le
 * rafraîchissement en arrière-plan du cache local. Les écritures
 * (création/modification/suppression) passent par ProductOfflineRepository
 * (cache local + queue), jamais par une Server Action dédiée — même
 * convention que Party/Transaction.
 */
export async function searchProductsAction(input: ProductSearchInput = {}) {
  const context = await requireTenantContext();
  const repository = new PrismaProductRepository(context.tenantId);

  const { search, categoryId, type } = productSearchSchema.parse(input);
  return searchProducts({ repository }, { search, categoryId, type });
}

export async function getProductByIdAction(id: string) {
  const context = await requireTenantContext();
  const repository = new PrismaProductRepository(context.tenantId);

  const product = await repository.findById(id);
  if (!product) {
    throw new NotFoundError("Product", id);
  }
  return product;
}
