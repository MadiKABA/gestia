import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import { TransactionCreateForm } from "@/presentation/transaction/components/transaction-create-form";

export default async function NouvelleTransactionPage() {
  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  return <TransactionCreateForm tenantId={context.tenantId} userId={context.userId} />;
}
