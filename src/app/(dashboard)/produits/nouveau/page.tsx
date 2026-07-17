import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import { searchProductCategoriesAction } from "@/presentation/product-category/actions";
import { getTenantBrandingAction } from "@/presentation/tenant/actions";
import { ProductForm } from "@/presentation/product/components/product-form";
import { productLabels } from "@/presentation/shared/labels";

export default async function NewProductPage() {
  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  // Réservé au patron (cahier des charges §2 : le vendeur ne fait que
  // consulter/sélectionner un produit existant) — même garde que la vraie
  // vérification côté use case (createProduct), ici seulement pour éviter
  // d'afficher un formulaire inutilisable.
  if (context.role !== "PATRON") {
    redirect("/produits");
  }

  const [categories, branding] = await Promise.all([
    searchProductCategoriesAction(),
    getTenantBrandingAction(),
  ]);

  return (
    <ProductForm
      mode="create"
      tenantId={context.tenantId}
      userId={context.userId}
      currency={branding.currency}
      initialCategories={categories.map((category) => ({ id: category.id, name: category.name }))}
      submitLabel={productLabels.createSubmitLabel}
    />
  );
}
