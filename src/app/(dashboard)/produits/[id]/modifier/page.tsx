import { notFound, redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import { getProductByIdAction } from "@/presentation/product/actions";
import { searchProductCategoriesAction } from "@/presentation/product-category/actions";
import { getTenantBrandingAction } from "@/presentation/tenant/actions";
import { ProductForm } from "@/presentation/product/components/product-form";
import { productLabels } from "@/presentation/shared/labels";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (context.role !== "PATRON") {
    redirect("/produits");
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

  return (
    <ProductForm
      mode="edit"
      productId={product.id}
      tenantId={context.tenantId}
      userId={context.userId}
      currency={branding.currency}
      defaultValues={{
        name: product.name,
        description: product.description ?? "",
        type: product.type,
        price: product.price,
        unit: product.unit,
        trackStock: product.trackStock,
        stockQuantity: product.stockQuantity,
        barcode: product.barcode ?? "",
        categoryId: product.categoryId,
      }}
      existingPhotoUrl={product.photoUrl}
      initialCategories={categories.map((category) => ({ id: category.id, name: category.name }))}
      submitLabel={productLabels.editSubmitLabel}
    />
  );
}
