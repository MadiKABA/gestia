import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Le patron désactive un vendeur de son tenant : celui-ci ne peut plus se
 * connecter (cahier des charges §4). `AuthRepository` n'étant pas tenant-scopé
 * (voir ARCHITECTURE.md), la cible est explicitement vérifiée ici.
 */
export async function deactivateVendeur(
  context: TenantContext,
  deps: { repository: AuthRepository; auditLogger: AuditLogger },
  input: { vendeurId: string },
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut désactiver un vendeur");
  }

  const vendeur = await deps.repository.findUserById(input.vendeurId);
  if (!vendeur || vendeur.tenantId !== context.tenantId || vendeur.role !== "VENDEUR") {
    throw new NotFoundError("User", input.vendeurId);
  }

  await deps.repository.setActive(vendeur.id, false);

  await deps.auditLogger.log(context, {
    action: "auth.vendeur_deactivated",
    entity: "User",
    entityId: vendeur.id,
  });
}
