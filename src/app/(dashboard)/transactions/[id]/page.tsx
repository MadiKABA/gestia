import { notFound, redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import { getTransactionByIdAction } from "@/presentation/transaction/actions";
import { TransactionDetail } from "@/presentation/transaction/components/transaction-detail";

export default async function TransactionDetailPage({
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

  let detail: Awaited<ReturnType<typeof getTransactionByIdAction>>;
  try {
    detail = await getTransactionByIdAction(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <TransactionDetail
      transaction={detail.transaction}
      partyName={detail.partyName}
      tenantId={context.tenantId}
      userId={context.userId}
      canDelete={context.role === "PATRON"}
    />
  );
}
