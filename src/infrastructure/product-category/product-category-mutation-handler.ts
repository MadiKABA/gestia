import type {
  MutationHandler,
  MutationHandlerResult,
} from "@/application/offline/mutation-handler";
import type { ProductCategoryInput } from "@/domain/product-category/product-category.entity";
import { ValidationError } from "@/domain/shared/errors";
import { createProductCategory } from "@/application/product-category/create-product-category.use-case";
import { PrismaProductCategoryRepository } from "@/infrastructure/product-category/product-category.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";

const auditLogger = new PrismaAuditLogger();

/**
 * Cible serveur réelle des mutations ProductCategory. Seule `create` est
 * jamais enfilée par le client (product-category-offline.repository.ts
 * n'expose ni update ni delete — aucun parcours de cette version ne modifie
 * ou ne supprime une catégorie, cf. CLAUDE.md Scope V1) : `update`/`delete`
 * ne sont implémentés que pour satisfaire l'interface `MutationHandler`,
 * jamais atteints en pratique.
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
      return { updatedAt: category.createdAt.toISOString() };
    } catch (error) {
      // Rejeu retry-safe (même raisonnement que partyMutationHandler) : la
      // contrainte unique sur l'id ne peut être violée que par une mutation
      // déjà appliquée dont la réponse n'a jamais atteint le client — une
      // collision sur `[tenantId, name]` (deux appareils créent la même
      // catégorie hors ligne) est en revanche un vrai conflit fonctionnel,
      // volontairement non résolu automatiquement ici (voir le commentaire
      // de classe de ProductCategoryRepository) : l'erreur remonte telle
      // quelle, l'utilisateur renomme et retente.
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await repository.findById(clientGeneratedId);
        if (existing) return { updatedAt: existing.createdAt.toISOString() };
      }
      throw error;
    }
  },

  async update(): Promise<MutationHandlerResult> {
    throw new ValidationError("La modification d'une catégorie n'est pas prise en charge");
  },

  async delete(): Promise<MutationHandlerResult> {
    throw new ValidationError("La suppression d'une catégorie n'est pas prise en charge");
  },
};
