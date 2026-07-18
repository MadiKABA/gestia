import { ProductCategoryOfflineRepository } from "@/infrastructure/product-category/product-category-offline.repository";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import type { ProductCategory } from "@/domain/product-category/product-category.entity";
import {
  syncTransport,
  triggerBackgroundSync,
} from "@/presentation/shared/hooks/use-network-status";

const ENTITY = "product_category";

export function createProductCategoryOfflineRepository(
  tenantId: string,
  userId: string,
  onOfflineFallback?: () => void,
): ProductCategoryOfflineRepository {
  return new ProductCategoryOfflineRepository({
    tenantId,
    userId,
    syncTransport,
    onSyncNeeded: () => triggerBackgroundSync(tenantId),
    onOfflineFallback,
  });
}

export async function seedProductCategoryCache(
  tenantId: string,
  categories: ProductCategory[],
): Promise<void> {
  await Promise.all(
    categories.map((category) =>
      setCachedEntity(tenantId, ENTITY, category.id, category, category.updatedAt.toISOString()),
    ),
  );
}
