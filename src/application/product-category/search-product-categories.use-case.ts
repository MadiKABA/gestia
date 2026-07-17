import type {
  ProductCategoryRepository,
  ProductCategorySearchQuery,
} from "@/application/product-category/product-category.repository";

export async function searchProductCategories(
  deps: { repository: ProductCategoryRepository },
  query: ProductCategorySearchQuery,
) {
  return deps.repository.findMany(query);
}
