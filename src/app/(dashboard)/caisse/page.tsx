import { redirect } from "next/navigation";
import { requirePatron } from "@/presentation/auth/require-role";
import { ForbiddenError } from "@/domain/shared/errors";
import {
  listCashMovementsAction,
  getCashBalanceAction,
} from "@/presentation/cash-movement/actions";
import { getTenantBrandingAction } from "@/presentation/tenant/actions";
import { CaissePage } from "@/presentation/cash-movement/components/caisse-page";

const PAGE_SIZE = 20;

export default async function CaisseRoutePage() {
  let context;
  try {
    context = await requirePatron();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/");
    }
    throw error;
  }

  const [{ items, total }, balance, branding] = await Promise.all([
    listCashMovementsAction({ page: 1, pageSize: PAGE_SIZE }),
    getCashBalanceAction(),
    getTenantBrandingAction(),
  ]);

  return (
    <CaissePage
      tenantId={context.tenantId}
      initialMovements={items}
      initialTotal={total}
      initialBalance={balance}
      currency={branding.currency}
    />
  );
}
