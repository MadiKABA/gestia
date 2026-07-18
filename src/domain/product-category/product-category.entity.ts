import { ValidationError } from "@/domain/shared/errors";

export type ProductCategory = {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductCategoryInput = {
  name: string;
};

export function validateProductCategoryInput(input: ProductCategoryInput): void {
  if (!input.name.trim()) {
    throw new ValidationError("Le nom de la catégorie est obligatoire");
  }
}
