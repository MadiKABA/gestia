import { redirect } from "next/navigation";
import { requirePatron } from "@/presentation/auth/require-role";
import { ForbiddenError } from "@/domain/shared/errors";
import { SaleCreateForm } from "@/presentation/cash-movement/components/sale-create-form";

export default async function NouvelleVentePage() {
  let context;
  try {
    context = await requirePatron();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/");
    }
    throw error;
  }

  return <SaleCreateForm tenantId={context.tenantId} userId={context.userId} />;
}
