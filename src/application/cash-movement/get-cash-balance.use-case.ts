import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError } from "@/domain/shared/errors";
import type { CashMovementRepository } from "@/application/cash-movement/cash-movement.repository";

/** Réservé au patron, même garde que createCashMovement. */
export async function getCashBalance(
  context: TenantContext,
  deps: { repository: CashMovementRepository },
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }

  return deps.repository.getBalance();
}
