import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/infrastructure/prisma/client";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { productCategoryMutationHandler } from "@/infrastructure/product-category/product-category-mutation-handler";
import { productCategorySyncPayloadSchema } from "@/infrastructure/product-category/product-category-mutation.schema";
import { productMutationHandler } from "@/infrastructure/product/product-mutation-handler";
import { productSyncPayloadSchema } from "@/infrastructure/product/product-mutation.schema";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { syncQueue } from "@/infrastructure/offline/sync-engine";
import {
  getMutation,
  listFailedMutations,
  listPendingMutations,
} from "@/infrastructure/offline/mutation-queue.store";
import { getDb } from "@/infrastructure/offline/db";
import { ProductCategoryOfflineRepository } from "@/infrastructure/product-category/product-category-offline.repository";
import { ProductOfflineRepository } from "@/infrastructure/product/product-offline.repository";
import { DependencyNotFoundError, ValidationError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { QueuedMutation } from "@/application/offline/mutation-handler";

/**
 * Même régression que party-transaction-dependency-order.test.ts, transposée
 * à ProductCategory -> Product : une catégorie créée à la volée hors ligne,
 * utilisée immédiatement pour créer un produit (toujours hors ligne, donc
 * `categoryId` référence un cuid client pas encore synchronisé). Réutilise
 * exactement le même mécanisme générique (DependencyNotFoundError côté
 * use case, DependencyPendingError + report de fin de cycle côté
 * sync-engine.ts) — rien de nouveau construit ici.
 */
describe("ProductCategory hors ligne -> Product hors ligne qui la référence : ordre de rejeu", () => {
  const tenantId = "test-tenant-category-product-dependency-order";
  const auditLogger = new PrismaAuditLogger();
  const context: TenantContext = { tenantId, userId: "", role: "PATRON" };

  // Reproduit le catch de syncMutationAction (presentation/offline/actions.ts).
  const syncTransport = async (mutation: QueuedMutation) => {
    try {
      return { ok: true as const, data: await syncMutation(context, { auditLogger }, mutation) };
    } catch (error) {
      if (error instanceof DependencyNotFoundError) {
        return {
          ok: false as const,
          reason: "dependency_not_found" as const,
          message: error.message,
        };
      }
      if (error instanceof ValidationError) {
        return { ok: false as const, reason: "validation_error" as const, message: error.message };
      }
      throw error;
    }
  };

  beforeAll(async () => {
    registerMutationHandler("product_category", productCategoryMutationHandler);
    registerMutationSchema("product_category", productCategorySyncPayloadSchema);
    registerMutationHandler("product", productMutationHandler);
    registerMutationSchema("product", productSyncPayloadSchema);

    await prisma.tenant.create({
      data: { id: tenantId, name: "Tenant dépendance ProductCategory/Product" },
    });
    const patron = await prisma.user.create({
      data: {
        tenantId,
        name: "Awa Ndiaye",
        phone: "+221799999960",
        pinHash: "unused",
        role: "PATRON",
      },
    });
    context.userId = patron.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.productCategory.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it("createdAt distincts (ordre naturel) : catégorie puis produit se synchronisent en un seul passage", async () => {
    const categoryRepo = new ProductCategoryOfflineRepository({ tenantId, userId: context.userId });
    const productRepo = new ProductOfflineRepository({ tenantId, userId: context.userId });

    const category = await categoryRepo.create({ name: "Épicerie" });
    const product = await productRepo.create({
      name: "Sac de riz 50kg",
      type: "PRODUIT",
      sellingPrice: 15000,
      categoryId: category.id,
    });

    const result = await syncQueue({ tenantId, syncTransport });

    expect(result).toEqual({ succeeded: 2, remaining: 0, failed: false });
    expect(await prisma.productCategory.findUnique({ where: { id: category.id } })).not.toBeNull();
    const productInDb = await prisma.product.findUnique({ where: { id: product.id } });
    expect(productInDb).not.toBeNull();
    expect(productInDb?.categoryId).toBe(category.id);
  });

  it("createdAt identique + Product trié avant ProductCategory (pire ordre) : résolu en un seul appel à syncQueue, jamais bloqué", async () => {
    const categoryRepo = new ProductCategoryOfflineRepository({ tenantId, userId: context.userId });
    const productRepo = new ProductOfflineRepository({ tenantId, userId: context.userId });

    const category = await categoryRepo.create({ name: "Boissons" });
    const product = await productRepo.create({
      name: "Jus de bissap 1L",
      type: "PRODUIT",
      sellingPrice: 1000,
      categoryId: category.id,
    });

    // Force le pire cas : `createdAt` identique (collision milliseconde) ET
    // l'id de la mutation Product forcé à trier avant celui de ProductCategory
    // dans l'ordre lexical (clé primaire IndexedDB "id", voir
    // party-transaction-dependency-order.test.ts pour le même mécanisme).
    const db = await getDb();
    const forcedCreatedAt = "2026-07-18T10:00:00.000Z";
    const rawBefore = await db.getAll("mutationQueue");
    for (const record of rawBefore.filter((r) => r.tenantId === tenantId && !r.synced)) {
      await db.delete("mutationQueue", record.id);
      const forcedId =
        record.entity === "product" ? "0-forced-product-first" : "9-forced-category-second";
      await db.put("mutationQueue", { ...record, id: forcedId, createdAt: forcedCreatedAt });
    }

    const pending = await listPendingMutations(tenantId);
    expect(pending[0].createdAt).toBe(pending[1].createdAt);
    expect(pending[0].entity).toBe("product"); // confirme le pire ordre forcé

    const result = await syncQueue({ tenantId, syncTransport });

    expect(result).toEqual({ succeeded: 2, remaining: 0, failed: false });
    expect(await prisma.productCategory.findUnique({ where: { id: category.id } })).not.toBeNull();
    const productInDb = await prisma.product.findUnique({ where: { id: product.id } });
    expect(productInDb).not.toBeNull();
    expect(productInDb?.categoryId).toBe(category.id);
    expect(await listFailedMutations(tenantId)).toHaveLength(0);
  });

  it("dépendance qui ne se résout jamais (catégorie jamais synchronisée) : bascule vers l'interface de résolution après 5 cycles", async () => {
    const productRepo = new ProductOfflineRepository({ tenantId, userId: context.userId });

    const neverSyncedCategoryId = createId();
    const product = await productRepo.create({
      name: "Produit orphelin",
      type: "PRODUIT",
      sellingPrice: 500,
      categoryId: neverSyncedCategoryId,
    });

    const mutation = await getMutation(
      (await listPendingMutations(tenantId)).find((m) => m.clientGeneratedId === product.id)!.id,
    );
    expect(mutation).toBeDefined();

    for (let cycle = 1; cycle <= 5; cycle++) {
      const result = await syncQueue({ tenantId, syncTransport });
      expect(result.succeeded).toBe(0);
      if (cycle < 5) {
        expect(await listPendingMutations(tenantId)).toHaveLength(1);
        expect(await listFailedMutations(tenantId)).toHaveLength(0);
      }
    }

    expect(await listPendingMutations(tenantId)).toHaveLength(0);
    const failed = await listFailedMutations(tenantId);
    expect(failed).toHaveLength(1);
    expect(failed[0].entity).toBe("product");
    expect(failed[0].syncError).toBe("En attente d'une autre donnée non encore synchronisée");
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();

    const sixthPass = await syncQueue({ tenantId, syncTransport });
    expect(sixthPass).toEqual({ succeeded: 0, remaining: 0, failed: false });
  });

  it("modification hors ligne d'une catégorie déjà synchronisée : synchronisée correctement", async () => {
    const categoryRepo = new ProductCategoryOfflineRepository({ tenantId, userId: context.userId });

    const category = await categoryRepo.create({ name: "Catégorie temporaire" });
    await syncQueue({ tenantId, syncTransport });

    // La modification a lieu dans une session hors ligne distincte (pas
    // enfilée avant que la création n'ait elle-même été synchronisée) — même
    // scénario réaliste que le formulaire catégorie (modifier puis
    // synchroniser plus tard, pas les deux mutations empilées avant tout
    // premier passage).
    const updated = await categoryRepo.update(category.id, { name: "Catégorie renommée" });
    expect(updated.name).toBe("Catégorie renommée");

    const result = await syncQueue({ tenantId, syncTransport });

    expect(result).toEqual({ succeeded: 1, remaining: 0, failed: false });
    const inDb = await prisma.productCategory.findUnique({ where: { id: category.id } });
    expect(inDb?.name).toBe("Catégorie renommée");
  });

  it("suppression hors ligne d'une catégorie déjà synchronisée : synchronisée correctement", async () => {
    const categoryRepo = new ProductCategoryOfflineRepository({ tenantId, userId: context.userId });

    const category = await categoryRepo.create({ name: "Catégorie à supprimer" });
    await syncQueue({ tenantId, syncTransport });

    await categoryRepo.delete(category.id);
    const result = await syncQueue({ tenantId, syncTransport });

    expect(result).toEqual({ succeeded: 1, remaining: 0, failed: false });
    const inDb = await prisma.productCategory.findUnique({ where: { id: category.id } });
    expect(inDb?.deletedAt).not.toBeNull();
  });
});
