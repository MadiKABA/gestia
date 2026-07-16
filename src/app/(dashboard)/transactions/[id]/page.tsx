import { notFound, redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import { getTransactionByIdAction } from "@/presentation/transaction/actions";
import { listPaymentsByTransactionAction } from "@/presentation/payment/actions";
import {
  getTenantWhatsappTemplateAction,
  getTenantWhatsappReceiptTemplatesAction,
  getTenantReminderDaysAction,
  getTenantBrandingAction,
} from "@/presentation/tenant/actions";
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

  const [payments, whatsappTemplate, whatsappReceiptTemplates, reminderDays, branding] =
    await Promise.all([
      listPaymentsByTransactionAction(id),
      getTenantWhatsappTemplateAction(),
      getTenantWhatsappReceiptTemplatesAction(),
      getTenantReminderDaysAction(),
      getTenantBrandingAction(),
    ]);

  return (
    <TransactionDetail
      transaction={detail.transaction}
      party={detail.party}
      whatsappTemplate={whatsappTemplate}
      whatsappReceiptTemplates={whatsappReceiptTemplates}
      boutique={branding.displayName ?? branding.tenantName}
      currency={branding.currency}
      reminderDays={reminderDays}
      tenantId={context.tenantId}
      userId={context.userId}
      canDelete={context.role === "PATRON"}
      initialPayments={payments}
    />
  );
}
