import { redirect } from "next/navigation";
import { requirePatron } from "@/presentation/auth/require-role";
import { ForbiddenError } from "@/domain/shared/errors";
import { CashMovementCreateForm } from "@/presentation/cash-movement/components/cash-movement-create-form";

export default async function NouveauMouvementCaissePage() {
  let context;
  try {
    context = await requirePatron();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/");
    }
    throw error;
  }

  return <CashMovementCreateForm tenantId={context.tenantId} userId={context.userId} />;
}
