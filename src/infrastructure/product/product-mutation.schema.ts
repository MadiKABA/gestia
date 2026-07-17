import { z } from "zod";
import {
  PRODUCT_UNIT_CODES,
  validateProductInput,
  type ProductInput,
} from "@/domain/product/product.entity";
import { ValidationError } from "@/domain/shared/errors";

/**
 * Photo sélectionnée localement, transportée en base64 dans le payload de
 * mutation (même en ligne : un seul chemin de code, voir
 * product-mutation-handler.ts) — la taille/format réels sont vérifiés côté
 * serveur par `validateProductPhotoFile` (product-photo.ts) après décodage,
 * pas ici : Zod ne fait qu'une validation de forme.
 */
const productPhotoSchema = z.object({
  mimeType: z.string(),
  base64: z.string().min(1),
});

/**
 * Schéma du payload de mutation Product tel qu'il transite dans la queue de
 * sync — la forme domaine `ProductInput`, même règle métier que le
 * formulaire (délégation à `validateProductInput` via `superRefine`, jamais
 * dupliquée), même pattern que partySyncPayloadSchema.
 */
export const productSyncPayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    type: z.enum(["PRODUIT", "SERVICE"]),
    price: z.number().min(0),
    unit: z.enum(PRODUCT_UNIT_CODES).nullable().optional(),
    trackStock: z.boolean().optional(),
    stockQuantity: z.number().min(0).nullable().optional(),
    barcode: z.string().trim().max(64).nullable().optional(),
    categoryId: z.string().nullable().optional(),
    photo: productPhotoSchema.nullable().optional(),
  })
  .superRefine((input, ctx) => {
    try {
      validateProductInput(input as ProductInput);
    } catch (error) {
      if (error instanceof ValidationError) {
        ctx.addIssue({ code: "custom", message: error.message, path: ["type"] });
      }
    }
  });
