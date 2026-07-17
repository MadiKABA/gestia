import { ProductOfflineRepository } from "@/infrastructure/product/product-offline.repository";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import type { Product } from "@/domain/product/product.entity";
import {
  syncTransport,
  triggerBackgroundSync,
} from "@/presentation/shared/hooks/use-network-status";

const ENTITY = "product";

/** Composition root du repository offline Product — voir
 * presentation/party/offline-repository.ts pour le même rôle côté Party. */
export function createProductOfflineRepository(
  tenantId: string,
  userId: string,
  onOfflineFallback?: () => void,
): ProductOfflineRepository {
  return new ProductOfflineRepository({
    tenantId,
    userId,
    syncTransport,
    onSyncNeeded: () => triggerBackgroundSync(tenantId),
    onOfflineFallback,
  });
}

/** Amorce le cache local avec les données fraîchement rendues côté serveur
 * (SSR) — pour qu'une prochaine visite hors ligne les retrouve déjà là. */
export async function seedProductCache(tenantId: string, products: Product[]): Promise<void> {
  await Promise.all(
    products.map((product) =>
      setCachedEntity(tenantId, ENTITY, product.id, product, product.updatedAt.toISOString()),
    ),
  );
}
