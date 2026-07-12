import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import {
  searchTransactionsAction,
  getTransactionBalanceSummaryAction,
} from "@/presentation/transaction/actions";
import { searchPartiesAction } from "@/presentation/party/actions";
import { getLastPaymentMethodsAction } from "@/presentation/payment/actions";
import {
  getTenantWhatsappReceiptTemplatesAction,
  getTenantReminderDaysAction,
} from "@/presentation/tenant/actions";
import { TransactionsList } from "@/presentation/transaction/components/transactions-list";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  const { type } = await searchParams;
  // Cases "Créances"/"Dettes" du menu (nav-config.ts) : même page, filtrée
  // dès le rendu serveur pour éviter un flash de la liste complète avant
  // que le filtre client ne s'applique.
  const initialType = type === "CREANCE" || type === "DETTE" ? type : undefined;

  const [transactions, parties, summary, whatsappReceiptTemplates, reminderDays] =
    await Promise.all([
      searchTransactionsAction({ type: initialType }),
      searchPartiesAction(),
      getTransactionBalanceSummaryAction(),
      getTenantWhatsappReceiptTemplatesAction(),
      getTenantReminderDaysAction(),
    ]);
  // Batch séparé (dépend des ids de transactions déjà résolus) : mode de
  // paiement du dernier paiement de chaque ligne, affiché en colonne
  // desktop/tablette (voir transactions-list.tsx).
  const lastPaymentMethodByTransactionId = await getLastPaymentMethodsAction(
    transactions.map((transaction) => transaction.id),
  );

  return (
    <TransactionsList
      initialTransactions={transactions}
      tenantId={context.tenantId}
      userId={context.userId}
      parties={parties.map((party) => ({
        id: party.id,
        name: party.name,
        phone: party.phone,
        whatsappNumber: party.whatsappNumber,
      }))}
      summary={summary}
      initialType={initialType}
      lastPaymentMethodByTransactionId={lastPaymentMethodByTransactionId}
      whatsappReceiptTemplates={whatsappReceiptTemplates}
      reminderDays={reminderDays}
    />
  );
}
