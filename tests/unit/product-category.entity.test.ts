import { describe, expect, it } from "vitest";
import { validateProductCategoryInput } from "@/domain/product-category/product-category.entity";
import { ValidationError } from "@/domain/shared/errors";

describe("validateProductCategoryInput", () => {
  it("accepte une catégorie avec un nom", () => {
    expect(() => validateProductCategoryInput({ name: "Boissons" })).not.toThrow();
  });

  it("rejette une catégorie sans nom", () => {
    expect(() => validateProductCategoryInput({ name: "  " })).toThrow(ValidationError);
  });
});
