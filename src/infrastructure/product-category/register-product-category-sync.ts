import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { productCategoryMutationHandler } from "@/infrastructure/product-category/product-category-mutation-handler";
import { productCategorySyncPayloadSchema } from "@/infrastructure/product-category/product-category-mutation.schema";
import { productCategoryPullHandler } from "@/infrastructure/product-category/product-category-pull-handler";

export function registerProductCategorySync(): void {
  registerMutationHandler("product_category", productCategoryMutationHandler);
  registerMutationSchema("product_category", productCategorySyncPayloadSchema);
  registerPullHandler("product_category", productCategoryPullHandler);
}
