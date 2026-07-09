import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError } from "@/domain/shared/errors";
import type {
  CashMovementListQuery,
  CashMovementRepository,
} from "@/application/cash-movement/cash-movement.repository";

/** Réservé au patron, même garde que createCashMovement. */
export async function listCashMovements(
  context: TenantContext,
  deps: { repository: CashMovementRepository },
  query: CashMovementListQuery,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }

  return deps.repository.findMany(query);
}
