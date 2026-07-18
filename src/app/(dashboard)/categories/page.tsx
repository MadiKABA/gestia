import { redirect } from "next/navigation";
import { requirePatron } from "@/presentation/auth/require-role";
import { listProductCategoriesWithCountsAction } from "@/presentation/product-category/actions";
import { ProductCategoriesPanel } from "@/presentation/product-category/components/product-categories-panel";
import { ForbiddenError } from "@/domain/shared/errors";

export default async function CategoriesPage() {
  let context;
  try {
    context = await requirePatron();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/");
    }
    throw error;
  }

  const categories = await listProductCategoriesWithCountsAction();
  return (
    <ProductCategoriesPanel
      initialCategories={categories}
      tenantId={context.tenantId}
      userId={context.userId}
    />
  );
}
