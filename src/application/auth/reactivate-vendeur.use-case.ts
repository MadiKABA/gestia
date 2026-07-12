import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Le patron réactive l'accès d'un vendeur précédemment désactivé (cahier des
 * charges §4). Mêmes gardes que `deactivateVendeur` : `AuthRepository` n'est
 * pas tenant-scopé (voir ARCHITECTURE.md), la cible est explicitement
 * vérifiée ici.
 */
export async function reactivateVendeur(
  context: TenantContext,
  deps: { repository: AuthRepository; auditLogger: AuditLogger },
  input: { vendeurId: string },
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut réactiver un vendeur");
  }

  const vendeur = await deps.repository.findUserById(input.vendeurId);
  if (!vendeur || vendeur.tenantId !== context.tenantId || vendeur.role !== "VENDEUR") {
    throw new NotFoundError("User", input.vendeurId);
  }

  await deps.repository.setActive(vendeur.id, true);

  await deps.auditLogger.log(context, {
    action: "auth.vendeur_reactivated",
    entity: "User",
    entityId: vendeur.id,
  });
}
