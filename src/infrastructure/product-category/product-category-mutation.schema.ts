import { z } from "zod";
import {
  validateProductCategoryInput,
  type ProductCategoryInput,
} from "@/domain/product-category/product-category.entity";
import { ValidationError } from "@/domain/shared/errors";

/** Schéma du payload de mutation ProductCategory, partagé par `create` et
 * `update` (même forme `{ name }` pour les deux) — `delete` ne passe jamais
 * par ce schéma (cf. sync-mutation.use-case.ts, payload `{}` non validé). */
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
