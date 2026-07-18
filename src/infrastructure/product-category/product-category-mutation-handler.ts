import type {
  ConflictInfo,
  MutationHandler,
  MutationHandlerResult,
} from "@/application/offline/mutation-handler";
import type { ProductCategoryInput } from "@/domain/product-category/product-category.entity";
import { ValidationError } from "@/domain/shared/errors";
import { detectConflict } from "@/domain/offline/conflict";
import { createProductCategory } from "@/application/product-category/create-product-category.use-case";
import { updateProductCategory } from "@/application/product-category/update-product-category.use-case";
import { deleteProductCategory } from "@/application/product-category/delete-product-category.use-case";
import { PrismaProductCategoryRepository } from "@/infrastructure/product-category/product-category.repository";
import { PrismaProductRepository } from "@/infrastructure/product/product.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";

const auditLogger = new PrismaAuditLogger();

/**
 * Cible serveur réelle des mutations ProductCategory — même contrat que
 * productMutationHandler. `delete` injecte `hasActiveProducts` depuis
 * `PrismaProductRepository` : seul ce composition root connaît à la fois
 * ProductCategory et Product (même raison que party-mutation-handler.ts
 * pour `hasOpenTransactions`).
 */
export const productCategoryMutationHandler: MutationHandler<ProductCategoryInput> = {
  async create(context, clientGeneratedId, payload): Promise<MutationHandlerResult> {
    const repository = new PrismaProductCategoryRepository(context.tenantId);
    try {
      const category = await createProductCategory(
        context,
        { repository, auditLogger },
        clientGeneratedId,
        payload,
      );
      return { updatedAt: category.updatedAt.toISOString() };
    } catch (error) {
      // Rejeu retry-safe (même raisonnement que partyMutationHandler) : la
      // contrainte unique sur l'id ne peut être violée que par une mutation
      // déjà appliquée dont la réponse n'a jamais atteint le client — une
      // collision sur `[tenantId, name]` (deux appareils créent la même
      // catégorie hors ligne) est en revanche un vrai conflit fonctionnel,
      // volontairement non résolu automatiquement ici : `ValidationError`
      // (pas l'erreur Prisma brute) pour que le client la traite comme
      // définitive plutôt que de la retenter indéfiniment (cf.
      // sync-mutation.use-case.ts), l'utilisateur renomme et retente.
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await repository.findById(clientGeneratedId);
        if (existing) return { updatedAt: existing.updatedAt.toISOString() };
        throw new ValidationError("Une catégorie porte déjà ce nom");
      }
      throw error;
    }
  },

  async update(context, id, payload, clientKnownUpdatedAt): Promise<MutationHandlerResult> {
    const repository = new PrismaProductCategoryRepository(context.tenantId);
    const conflict = await detectProductCategoryConflict(repository, id, clientKnownUpdatedAt);

    try {
      const updated = await updateProductCategory(
        context,
        { repository, auditLogger },
        id,
        payload,
      );
      return { updatedAt: updated.updatedAt.toISOString(), conflict };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ValidationError("Une catégorie porte déjà ce nom");
      }
      throw error;
    }
  },

  async delete(context, id, clientKnownUpdatedAt): Promise<MutationHandlerResult> {
    const repository = new PrismaProductCategoryRepository(context.tenantId);
    const productRepository = new PrismaProductRepository(context.tenantId);
    const conflict = await detectProductCategoryConflict(repository, id, clientKnownUpdatedAt);

    const deleted = await deleteProductCategory(
      context,
      {
        repository,
        auditLogger,
        hasActiveProducts: (categoryId) =>
          productRepository.hasActiveProductsInCategory(categoryId),
      },
      id,
    );
    return { updatedAt: deleted.updatedAt.toISOString(), conflict };
  },
};

async function detectProductCategoryConflict(
  repository: PrismaProductCategoryRepository,
  id: string,
  clientKnownUpdatedAt: string,
): Promise<ConflictInfo | undefined> {
  const existing = await repository.findById(id);
  if (!existing) return undefined;
  const serverUpdatedAtBeforeOverwrite = existing.updatedAt.toISOString();
  if (!detectConflict(clientKnownUpdatedAt, serverUpdatedAtBeforeOverwrite)) return undefined;
  return { serverValueBeforeOverwrite: existing, serverUpdatedAtBeforeOverwrite };
}
