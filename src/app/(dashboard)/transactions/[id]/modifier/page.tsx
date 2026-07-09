import { notFound, redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import { getTransactionByIdAction } from "@/presentation/transaction/actions";
import { searchPartiesAction } from "@/presentation/party/actions";
import { TransactionForm } from "@/presentation/transaction/components/transaction-form";
import { transactionLabels } from "@/presentation/shared/labels";

export default async function ModifierTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  let transaction;
  try {
    ({ transaction } = await getTransactionByIdAction(id));
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const parties = await searchPartiesAction();

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="text-foreground mb-4 text-lg font-semibold">
        {transactionLabels.editPageTitle}
      </h1>
      <TransactionForm
        mode="edit"
        transactionId={id}
        tenantId={context.tenantId}
        userId={context.userId}
        parties={parties.map((party) => ({ id: party.id, name: party.name }))}
        defaultValues={{
          partyId: transaction.partyId,
          type: transaction.type,
          description: transaction.description,
          quantity: transaction.quantity,
          amount: transaction.amount,
          dueDate: transaction.dueDate ? transaction.dueDate.toISOString().slice(0, 10) : "",
        }}
        submitLabel={transactionLabels.editSubmitLabel}
      />
    </div>
  );
}
