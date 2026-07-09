import type { TenantContext } from "@/domain/shared/tenant-context";
import type { CashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import { validateCashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import { ForbiddenError } from "@/domain/shared/errors";
import type { CashMovementRepository } from "@/application/cash-movement/cash-movement.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Réservé au patron : jamais de trésorerie globale pour un vendeur (cahier
 * des charges §2, CLAUDE.md "Rôles") — même garde que delete-transaction.use-case.ts.
 */
export async function createCashMovement(
  context: TenantContext,
  deps: { repository: CashMovementRepository; auditLogger: AuditLogger },
  id: string,
  input: CashMovementInput,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }

  validateCashMovementInput(input);

  const movement = await deps.repository.create(id, input, context.userId);

  await deps.auditLogger.log(context, {
    action: "cash-movement.created",
    entity: "CashMovement",
    entityId: movement.id,
    newData: movement,
  });

  return movement;
}
