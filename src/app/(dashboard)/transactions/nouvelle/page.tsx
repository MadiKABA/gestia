import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import { searchPartiesAction } from "@/presentation/party/actions";
import { TransactionForm } from "@/presentation/transaction/components/transaction-form";
import { transactionLabels } from "@/presentation/shared/labels";

export default async function NouvelleTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ partyId?: string; type?: string }>;
}) {
  const { partyId, type } = await searchParams;

  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  const parties = await searchPartiesAction();
  const resolvedType = type === "DETTE" ? "DETTE" : "CREANCE";
  const title =
    resolvedType === "DETTE"
      ? transactionLabels.newPageTitleDette
      : transactionLabels.newPageTitleCreance;

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="text-foreground mb-4 text-lg font-semibold">{title}</h1>
      <TransactionForm
        mode="create"
        tenantId={context.tenantId}
        userId={context.userId}
        parties={parties.map((party) => ({ id: party.id, name: party.name }))}
        defaultValues={{ partyId: partyId ?? "", type: resolvedType }}
        submitLabel={transactionLabels.createSubmitLabel}
      />
    </div>
  );
}
