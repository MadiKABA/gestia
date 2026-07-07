import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type { PartyRepository } from "@/application/party/party.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Soft delete réservé au patron (cahier des charges §2 : le vendeur n'a
 * jamais accès à la suppression).
 *
 * TODO(module Transaction) : une fois Transaction implémenté, bloquer (ou au
 * minimum avertir fortement) la suppression d'un client qui a des
 * transactions en cours (CREANCE/DETTE non soldées) — non applicable pour
 * l'instant puisque Transaction n'existe pas encore. Voir CLAUDE.md.
 */
export async function deleteParty(
  context: TenantContext,
  deps: { repository: PartyRepository; auditLogger: AuditLogger },
  id: string,
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Réservé au patron");
  }

  const existing = await deps.repository.findById(id);
  if (!existing) {
    throw new NotFoundError("Party", id);
  }

  const deleted = await deps.repository.delete(id);

  await deps.auditLogger.log(context, {
    action: "party.deleted",
    entity: "Party",
    entityId: deleted.id,
    oldData: existing,
  });

  return deleted;
}
