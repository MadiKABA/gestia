import { registerPullableEntity } from "@/infrastructure/offline/pull-registry";

export function registerProductCategoryPullable(): void {
  registerPullableEntity("product_category");
}
