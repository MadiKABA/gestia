import { z } from "zod";
import {
  validateProductCategoryInput,
  type ProductCategoryInput,
} from "@/domain/product-category/product-category.entity";
import { ValidationError } from "@/domain/shared/errors";

/** Schéma du payload de mutation ProductCategory — seule l'action `create`
 * est réellement utilisée (pas d'update/delete pour cette entity, voir
 * product-category-mutation-handler.ts), même schéma pour les trois par
 * contrainte du moteur générique (un seul schéma par entity). */
export const productCategorySyncPayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
  })
  .superRefine((input, ctx) => {
    try {
      validateProductCategoryInput(input as ProductCategoryInput);
    } catch (error) {
      if (error instanceof ValidationError) {
        ctx.addIssue({ code: "custom", message: error.message, path: ["name"] });
      }
    }
  });
