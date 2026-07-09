import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import { searchTransactionsAction } from "@/presentation/transaction/actions";
import { searchPartiesAction } from "@/presentation/party/actions";
import { TransactionsList } from "@/presentation/transaction/components/transactions-list";

export default async function TransactionsPage() {
  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  const [transactions, parties] = await Promise.all([
    searchTransactionsAction(),
    searchPartiesAction(),
  ]);

  return (
    <TransactionsList
      initialTransactions={transactions}
      tenantId={context.tenantId}
      userId={context.userId}
      parties={parties.map((party) => ({ id: party.id, name: party.name }))}
    />
  );
}
