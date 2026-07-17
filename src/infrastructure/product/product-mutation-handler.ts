import type {
  ConflictInfo,
  MutationHandler,
  MutationHandlerResult,
} from "@/application/offline/mutation-handler";
import type { ProductInput } from "@/domain/product/product.entity";
import type { ResolvedProductInput } from "@/application/product/product.repository";
import { validateProductPhotoFile } from "@/domain/product/product-photo";
import { ValidationError } from "@/domain/shared/errors";
import { detectConflict } from "@/domain/offline/conflict";
import { createProduct } from "@/application/product/create-product.use-case";
import { updateProduct } from "@/application/product/update-product.use-case";
import { deleteProduct } from "@/application/product/delete-product.use-case";
import { PrismaProductRepository } from "@/infrastructure/product/product.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { CloudinaryProductPhotoUploader } from "@/infrastructure/external/cloudinary-client";
import { PrismaClientKnownRequestError } from "@/generated/prisma/internal/prismaNamespace";

const auditLogger = new PrismaAuditLogger();
const photoUploader = new CloudinaryProductPhotoUploader();

/**
 * Résout `ProductInput.photo` (base64, transporté tel quel dans la queue de
 * sync, que la mutation soit tentée immédiatement en ligne ou rejouée plus
 * tard) en `photoUrl` Cloudinary — seul endroit du code qui parle à
 * Cloudinary pour ce module. Un seul chemin, en ligne comme hors ligne :
 * l'upload différé (cahier des charges catalogue produits) n'est donc pas un
 * cas particulier, juste la conséquence naturelle de la mutation rejouée par
 * la queue quand elle n'a pas pu être tentée tout de suite.
 *
 * `undefined` = aucun changement de photo (update sans nouvelle sélection) ;
 * `null` = suppression explicite de la photo existante.
 */
async function resolvePhoto(
  photo: ProductInput["photo"],
  tenantId: string,
  productId: string,
): Promise<string | null | undefined> {
  if (photo === undefined) return undefined;
  if (photo === null) return null;

  const buffer = Buffer.from(photo.base64, "base64");
  validateProductPhotoFile({
    mimeType: photo.mimeType,
    sizeBytes: buffer.byteLength,
    content: buffer,
  });
  const { url } = await photoUploader.upload(
    { buffer, mimeType: photo.mimeType },
    tenantId,
    productId,
  );
  return url;
}

function toResolvedInput(
  payload: ProductInput,
  photoUrl: string | null | undefined,
): ResolvedProductInput {
  const { photo: _photo, ...rest } = payload;
  return { ...rest, photoUrl };
}

/**
 * Cible serveur réelle des mutations Product synchronisées — appelée
 * uniquement par le moteur de sync générique, jamais directement par une
 * Server Action de formulaire (même contrat que partyMutationHandler).
 */
export const productMutationHandler: MutationHandler<ProductInput> = {
  async create(context, clientGeneratedId, payload): Promise<MutationHandlerResult> {
    const repository = new PrismaProductRepository(context.tenantId);
    const photoUrl = await resolvePhoto(payload.photo, context.tenantId, clientGeneratedId);
    try {
      const product = await createProduct(
        context,
        { repository, auditLogger },
        clientGeneratedId,
        toResolvedInput(payload, photoUrl),
      );
      return { updatedAt: product.updatedAt.toISOString() };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        // Rejeu retry-safe (même raisonnement que partyMutationHandler) : la
        // contrainte unique sur Product.id ne peut être violée que par une
        // mutation déjà appliquée dont la réponse n'a jamais atteint le
        // client. Si ce N'EST PAS le cas (id jamais créé), la violation
        // vient forcément de l'autre contrainte unique du modèle
        // (`[tenantId, barcode]`, cf. schema.prisma) : un vrai conflit
        // fonctionnel, jamais résolu automatiquement, contrairement au
        // rejeu — l'utilisateur corrige le code-barres et retente.
        const existing = await repository.findById(clientGeneratedId);
        if (existing) return { updatedAt: existing.updatedAt.toISOString() };
        throw new ValidationError("Ce code-barres est déjà utilisé par un autre produit");
      }
      throw error;
    }
  },

  async update(context, id, payload, clientKnownUpdatedAt): Promise<MutationHandlerResult> {
    const repository = new PrismaProductRepository(context.tenantId);
    const conflict = await detectProductConflict(repository, id, clientKnownUpdatedAt);
    const photoUrl = await resolvePhoto(payload.photo, context.tenantId, id);

    try {
      const updated = await updateProduct(
        context,
        { repository, auditLogger },
        id,
        toResolvedInput(payload, photoUrl),
      );
      return { updatedAt: updated.updatedAt.toISOString(), conflict };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ValidationError("Ce code-barres est déjà utilisé par un autre produit");
      }
      throw error;
    }
  },

  async delete(context, id, clientKnownUpdatedAt): Promise<MutationHandlerResult> {
    const repository = new PrismaProductRepository(context.tenantId);
    const conflict = await detectProductConflict(repository, id, clientKnownUpdatedAt);

    const deleted = await deleteProduct(context, { repository, auditLogger }, id);
    return { updatedAt: deleted.updatedAt.toISOString(), conflict };
  },
};

async function detectProductConflict(
  repository: PrismaProductRepository,
  id: string,
  clientKnownUpdatedAt: string,
): Promise<ConflictInfo | undefined> {
  const existing = await repository.findById(id);
  if (!existing) return undefined;
  const serverUpdatedAtBeforeOverwrite = existing.updatedAt.toISOString();
  if (!detectConflict(clientKnownUpdatedAt, serverUpdatedAtBeforeOverwrite)) return undefined;
  return { serverValueBeforeOverwrite: existing, serverUpdatedAtBeforeOverwrite };
}
