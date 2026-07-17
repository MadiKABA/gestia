import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import { searchProductsAction } from "@/presentation/product/actions";
import { searchProductCategoriesAction } from "@/presentation/product-category/actions";
import { getTenantBrandingAction } from "@/presentation/tenant/actions";
import { ProductsList } from "@/presentation/product/components/products-list";

export default async function ProductsPage() {
  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  const [products, categories, branding] = await Promise.all([
    searchProductsAction(),
    searchProductCategoriesAction(),
    getTenantBrandingAction(),
  ]);

  return (
    <ProductsList
      initialProducts={products}
      tenantId={context.tenantId}
      userId={context.userId}
      canManage={context.role === "PATRON"}
      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      currency={branding.currency}
    />
  );
}
