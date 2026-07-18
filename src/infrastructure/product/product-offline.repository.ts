import type { OfflineFirstRepository } from "@/application/offline/offline-first-repository";
import type { ProductSearchQuery } from "@/application/product/product.repository";
import {
  validateProductInput,
  type Product,
  type ProductInput,
} from "@/domain/product/product.entity";
import { ValidationError } from "@/domain/shared/errors";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncTransport } from "@/infrastructure/offline/sync-engine";
import { attemptOnlineMutation } from "@/infrastructure/offline/online-first-mutation";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import {
  getCachedEntity,
  listCachedEntities,
  removeCachedEntity,
  setCachedEntity,
} from "@/infrastructure/offline/local-cache.store";
import { enqueueMutation } from "@/infrastructure/offline/mutation-queue.store";
import { isOnline } from "@/infrastructure/offline/platform";

const ENTITY = "product";

export type ProductOfflineDeps = {
  tenantId: string;
  userId: string;
  syncTransport?: SyncTransport;
  onSyncNeeded?: () => void;
  onOfflineFallback?: () => void;
};

/**
 * Repository "online-first, repli offline" du module Product, même pattern
 * que TransactionOfflineRepository/PartyOfflineRepository. Écart assumé :
 * `photoUrl` ne peut jamais être connu localement à la création/à une
 * édition avec nouvelle photo (upload Cloudinary résolu par le
 * mutation-handler serveur, cf. product-mutation-handler.ts) — posé à `null`
 * (création) ou conservé tel quel (édition sans suppression explicite)
 * jusqu'à ce que le pull générique rapatrie l'URL réelle, même principe que
 * `reference: null` pour Transaction.
 */
export class ProductOfflineRepository implements OfflineFirstRepository<
  Product,
  ProductInput,
  ProductSearchQuery
> {
  constructor(private readonly deps: ProductOfflineDeps) {}

  async create(input: ProductInput): Promise<Product> {
    validateProductInput(input);

    const id = generateClientId();
    const now = new Date();
    const product: Product = {
      id,
      tenantId: this.deps.tenantId,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      purchasePrice: input.purchasePrice ?? null,
      sellingPrice: input.sellingPrice,
      unit: input.type === "SERVICE" ? null : (input.unit ?? null),
      trackStock: input.type === "SERVICE" ? false : (input.trackStock ?? false),
      stockQuantity: input.type === "SERVICE" ? null : (input.stockQuantity ?? null),
      barcode: input.barcode ?? null,
      photoUrl: null,
      categoryId: input.categoryId ?? null,
      createdById: this.deps.userId,
      createdAt: now,
      updatedAt: now,
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
      if (result.status === "validation_error" || result.status === "dependency_not_found") {
        throw new ValidationError(result.message);
      }
      if (result.status === "success") {
        const confirmed = { ...product, updatedAt: new Date(result.updatedAt) };
        await setCachedEntity(this.deps.tenantId, ENTITY, id, confirmed, result.updatedAt);
        this.deps.onSyncNeeded?.(); // photoUrl réelle rapatriée par le pull qui suit
        return confirmed;
      }
      // "transient_error" : repli sur le chemin hors ligne ci-dessous.
    }

    await setCachedEntity(this.deps.tenantId, ENTITY, id, product, now.toISOString());
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

    return product;
  }

  async update(id: string, input: ProductInput): Promise<Product> {
    validateProductInput(input);

    const cached = await getCachedEntity<Product>(this.deps.tenantId, ENTITY, id);
    const now = new Date();
    const updated: Product = {
      id,
      tenantId: this.deps.tenantId,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      purchasePrice: input.purchasePrice ?? null,
      sellingPrice: input.sellingPrice,
      unit: input.type === "SERVICE" ? null : (input.unit ?? null),
      trackStock: input.type === "SERVICE" ? false : (input.trackStock ?? false),
      stockQuantity: input.type === "SERVICE" ? null : (input.stockQuantity ?? null),
      barcode: input.barcode ?? null,
      // `photo === null` (suppression explicite) s'applique tout de suite ;
      // une nouvelle photo (`photo` renseigné) ou aucun changement (`photo`
      // absent) gardent l'URL actuelle en attendant la confirmation serveur
      // — les deux cas convergent vers la même expression ici.
      photoUrl: input.photo === null ? null : (cached?.data.photoUrl ?? null),
      categoryId: input.categoryId ?? null,
      createdById: cached?.data.createdById ?? this.deps.userId,
      createdAt: cached?.data.createdAt ?? now,
      updatedAt: now,
    };
    const knownServerUpdatedAt = cached?.updatedAt ?? now.toISOString();

    if (isOnline() && this.deps.syncTransport) {
      const mutation: QueuedMutation = {
        id: generateClientId(),
        tenantId: this.deps.tenantId,
        entity: ENTITY,
        action: "update",
        payload: input,
        clientGeneratedId: id,
        clientKnownUpdatedAt: knownServerUpdatedAt,
        createdAt: now.toISOString(),
        createdById: this.deps.userId,
      };
      const result = await attemptOnlineMutation(this.deps.syncTransport, mutation);
      if (result.status === "validation_error") {
        throw new ValidationError(result.message);
      }
      if (result.status === "success") {
        const confirmed = { ...updated, updatedAt: new Date(result.updatedAt) };
        await setCachedEntity(this.deps.tenantId, ENTITY, id, confirmed, result.updatedAt);
        this.deps.onSyncNeeded?.();
        return confirmed;
      }
    }

    await setCachedEntity(this.deps.tenantId, ENTITY, id, updated, knownServerUpdatedAt);
    await enqueueMutation({
      id: generateClientId(),
      tenantId: this.deps.tenantId,
      entity: ENTITY,
      action: "update",
      payload: input,
      clientGeneratedId: id,
      createdById: this.deps.userId,
    });
    this.deps.onSyncNeeded?.();
    this.deps.onOfflineFallback?.();

    return updated;
  }

  async delete(id: string): Promise<void> {
    const cached = await getCachedEntity<Product>(this.deps.tenantId, ENTITY, id);

    if (isOnline() && this.deps.syncTransport) {
      const mutation: QueuedMutation = {
        id: generateClientId(),
        tenantId: this.deps.tenantId,
        entity: ENTITY,
        action: "delete",
        payload: {},
        clientGeneratedId: id,
        clientKnownUpdatedAt: cached?.updatedAt,
        createdAt: new Date().toISOString(),
        createdById: this.deps.userId,
      };
      const result = await attemptOnlineMutation(this.deps.syncTransport, mutation);
      if (result.status === "validation_error") {
        throw new ValidationError(result.message);
      }
      if (result.status === "success") {
        await removeCachedEntity(this.deps.tenantId, ENTITY, id);
        this.deps.onSyncNeeded?.();
        return;
      }
    }

    await removeCachedEntity(this.deps.tenantId, ENTITY, id);
    await enqueueMutation({
      id: generateClientId(),
      tenantId: this.deps.tenantId,
      entity: ENTITY,
      action: "delete",
      payload: {},
      clientGeneratedId: id,
      createdById: this.deps.userId,
      clientKnownUpdatedAt: cached?.updatedAt,
    });
    this.deps.onSyncNeeded?.();
  }

  async getById(id: string): Promise<Product | null> {
    const cached = await getCachedEntity<Product>(this.deps.tenantId, ENTITY, id);
    if (isOnline()) this.deps.onSyncNeeded?.();
    return cached?.data ?? null;
  }

  async list(filters: ProductSearchQuery): Promise<Product[]> {
    const cached = await listCachedEntities<Product>(this.deps.tenantId, ENTITY);
    const filtered = applyLocalFilters(
      cached.map((c) => c.data),
      filters,
    );
    if (isOnline()) this.deps.onSyncNeeded?.();
    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

function applyLocalFilters(products: Product[], filters: ProductSearchQuery): Product[] {
  return products.filter((product) => {
    if (filters.categoryId && product.categoryId !== filters.categoryId) return false;
    if (filters.type && product.type !== filters.type) return false;
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const matchesName = product.name.toLowerCase().includes(term);
      const matchesBarcode = product.barcode?.toLowerCase().includes(term) ?? false;
      if (!matchesName && !matchesBarcode) return false;
    }
    return true;
  });
}
