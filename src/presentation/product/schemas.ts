import { z } from "zod";
import { validateProductInput, PRODUCT_UNIT_CODES } from "@/domain/product/product.entity";
import type { ProductInput } from "@/domain/product/product.entity";
import { ValidationError } from "@/domain/shared/errors";
import { productLabels } from "@/presentation/shared/labels";

/** Le formulaire délègue les règles croisées type/unité/stock à
 * `validateProductInput` (domain) via `superRefine` — jamais de duplication
 * de la règle métier côté Zod, même principe que partyInputSchema. */
export const productInputSchema = z
  .object({
    name: z.string().trim().min(1, productLabels.nameRequiredError),
    description: z.string().trim().optional().or(z.literal("")),
    type: z.enum(["PRODUIT", "SERVICE"]),
    purchasePrice: z.number().min(0, productLabels.purchasePriceInvalidError).nullable().optional(),
    sellingPrice: z.number().min(0, productLabels.sellingPriceInvalidError),
    unit: z.enum(PRODUCT_UNIT_CODES).nullable().optional(),
    trackStock: z.boolean(),
    stockQuantity: z.number().min(0).nullable().optional(),
    barcode: z.string().trim().optional().or(z.literal("")),
    categoryId: z.string().nullable().optional(),
  })
  .superRefine((input, ctx) => {
    try {
      validateProductInput({
        name: input.name,
        type: input.type,
        purchasePrice: input.purchasePrice,
        sellingPrice: input.sellingPrice,
        unit: input.type === "PRODUIT" ? input.unit : null,
        trackStock: input.type === "PRODUIT" ? input.trackStock : false,
        stockQuantity: input.type === "PRODUIT" ? input.stockQuantity : null,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        ctx.addIssue({ code: "custom", message: error.message, path: ["type"] });
      }
    }
  });

export type ProductFormInput = z.infer<typeof productInputSchema>;

/** Les champs texte optionnels du formulaire arrivent en chaîne vide plutôt
 * qu'`undefined` (contrôle React) — normalisés en `null` pour le domaine.
 * `photo` est géré séparément par ProductPhotoInput (pas un champ Zod du
 * formulaire, jamais soumis via react-hook-form-like state ici). */
export function toProductInput(
  input: ProductFormInput,
  photo: ProductInput["photo"],
): ProductInput {
  return {
    name: input.name,
    description: input.description || null,
    type: input.type,
    purchasePrice: input.purchasePrice ?? null,
    sellingPrice: input.sellingPrice,
    unit: input.type === "PRODUIT" ? (input.unit ?? null) : null,
    trackStock: input.type === "PRODUIT" ? input.trackStock : false,
    stockQuantity: input.type === "PRODUIT" ? (input.stockQuantity ?? null) : null,
    barcode: input.barcode || null,
    categoryId: input.categoryId || null,
    photo,
  };
}

export const productSearchSchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().optional(),
  type: z.enum(["PRODUIT", "SERVICE"]).optional(),
});
export type ProductSearchInput = z.infer<typeof productSearchSchema>;
