import { notFound, redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import { getProductByIdAction } from "@/presentation/product/actions";
import { searchProductCategoriesAction } from "@/presentation/product-category/actions";
import { getTenantBrandingAction } from "@/presentation/tenant/actions";
import { ProductDetail } from "@/presentation/product/components/product-detail";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  let product;
  try {
    product = await getProductByIdAction(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const [categories, branding] = await Promise.all([
    searchProductCategoriesAction(),
    getTenantBrandingAction(),
  ]);
  const categoryName =
    categories.find((category) => category.id === product.categoryId)?.name ?? null;

  return (
    <ProductDetail
      product={product}
      categoryName={categoryName}
      tenantId={context.tenantId}
      userId={context.userId}
      canManage={context.role === "PATRON"}
      currency={branding.currency}
    />
  );
}
