import type {
  ProductRepository,
  ProductSearchQuery,
} from "@/application/product/product.repository";

export async function searchProducts(
  deps: { repository: ProductRepository },
  query: ProductSearchQuery,
) {
  return deps.repository.findMany(query);
}
