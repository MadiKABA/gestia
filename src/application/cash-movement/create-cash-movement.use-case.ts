import type { TenantContext } from "@/domain/shared/tenant-context";
import type { CashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import { validateCashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import { DependencyNotFoundError, ForbiddenError } from "@/domain/shared/errors";
import type { CashMovementRepository } from "@/application/cash-movement/cash-movement.repository";
import type { PartyRepository } from "@/application/party/party.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Réservé au patron : jamais de trésorerie globale pour un vendeur (cahier
 * des charges §2, CLAUDE.md "Rôles") — même garde que delete-transaction.use-case.ts.
 */
export async function createCashMovement(
  context: TenantContext,
  deps: {
    repository: CashMovementRepository;
    partyRepository: PartyRepository;
    auditLogger: AuditLogger;
  },
  id: string,
  input: CashMovementInput,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }

  validateCashMovementInput(input);

  // `partyId` optionnel (vente au comptant uniquement) : vérifié seulement
  // s'il est fourni, contrairement à create-transaction.use-case.ts où il
  // est obligatoire. DependencyNotFoundError (pas NotFoundError) car ce
  // Party peut avoir été créé hors ligne dans la même session, pas encore
  // synchronisé — voir infrastructure/offline/sync-engine.ts.
  if (input.partyId) {
    const party = await deps.partyRepository.findById(input.partyId);
    if (!party) {
      throw new DependencyNotFoundError("Party", input.partyId);
    }
  }

  const movement = await deps.repository.create(id, input, context.userId);

  await deps.auditLogger.log(context, {
    action: "cash-movement.created",
    entity: "CashMovement",
    entityId: movement.id,
    newData: movement,
  });

  return movement;
}
