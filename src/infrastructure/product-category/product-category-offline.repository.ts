import type { ProductCategorySearchQuery } from "@/application/product-category/product-category.repository";
import {
  validateProductCategoryInput,
  type ProductCategory,
  type ProductCategoryInput,
} from "@/domain/product-category/product-category.entity";
import { ValidationError } from "@/domain/shared/errors";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncTransport } from "@/infrastructure/offline/sync-engine";
import { attemptOnlineMutation } from "@/infrastructure/offline/online-first-mutation";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import {
  getCachedEntity,
  listCachedEntities,
  setCachedEntity,
} from "@/infrastructure/offline/local-cache.store";
import { enqueueMutation } from "@/infrastructure/offline/mutation-queue.store";
import { isOnline } from "@/infrastructure/offline/platform";

const ENTITY = "product_category";

export type ProductCategoryOfflineDeps = {
  tenantId: string;
  userId: string;
  syncTransport?: SyncTransport;
  onSyncNeeded?: () => void;
  onOfflineFallback?: () => void;
};

/**
 * Repository "online-first, repli offline" du module ProductCategory —
 * volontairement plus restreint que `OfflineFirstRepository<T,...>` : ni
 * `update` ni `delete`, aucun parcours de cette version ne modifie ou ne
 * supprime une catégorie (création à la volée + sélection uniquement, cf.
 * CLAUDE.md Scope V1). Un P2002 sur `[tenantId, name]` (deux appareils créent
 * la même catégorie hors ligne) remonte comme `ValidationError` — conflit
 * fonctionnel assumé, jamais résolu automatiquement (voir
 * product-category-mutation-handler.ts).
 */
export class ProductCategoryOfflineRepository {
  constructor(private readonly deps: ProductCategoryOfflineDeps) {}

  async create(input: ProductCategoryInput): Promise<ProductCategory> {
    validateProductCategoryInput(input);

    const id = generateClientId();
    const now = new Date();
    const category: ProductCategory = {
      id,
      tenantId: this.deps.tenantId,
      name: input.name,
      createdAt: now,
    };

    if (isOnline() && this.deps.syncTransport) {
      const mutation: QueuedMutation = {
        id: generateClientId(),
        tenantId: this.deps.tenantId,
        entity: ENTITY,
        action: "create",
        payload: input,
        clientGeneratedId: id,
        createdAt: now.toISOString(),
        createdById: this.deps.userId,
      };
      const result = await attemptOnlineMutation(this.deps.syncTransport, mutation);
      if (result.status === "validation_error") {
        throw new ValidationError(result.message);
      }
      if (result.status === "success") {
        await setCachedEntity(this.deps.tenantId, ENTITY, id, category, result.updatedAt);
        this.deps.onSyncNeeded?.();
        return category;
      }
    }

    await setCachedEntity(this.deps.tenantId, ENTITY, id, category, now.toISOString());
    await enqueueMutation({
      id: generateClientId(),
      tenantId: this.deps.tenantId,
      entity: ENTITY,
      action: "create",
      payload: input,
      clientGeneratedId: id,
      createdById: this.deps.userId,
    });
    this.deps.onSyncNeeded?.();
    this.deps.onOfflineFallback?.();

    return category;
  }

  async getById(id: string): Promise<ProductCategory | null> {
    const cached = await getCachedEntity<ProductCategory>(this.deps.tenantId, ENTITY, id);
    return cached?.data ?? null;
  }

  async list(filters: ProductCategorySearchQuery = {}): Promise<ProductCategory[]> {
    const cached = await listCachedEntities<ProductCategory>(this.deps.tenantId, ENTITY);
    const filtered = filters.search
      ? cached.filter((c) => c.data.name.toLowerCase().includes(filters.search!.toLowerCase()))
      : cached;
    if (isOnline()) this.deps.onSyncNeeded?.();
    return filtered.map((c) => c.data).sort((a, b) => a.name.localeCompare(b.name));
  }
}
