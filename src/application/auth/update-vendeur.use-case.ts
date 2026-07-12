import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Le patron modifie le nom d'un vendeur de son tenant (cahier des charges §4 :
 * "ajouter, modifier, désactiver"). Le téléphone (identifiant de connexion)
 * n'est volontairement pas modifiable ici : le changer poserait des questions
 * de sécurité hors scope — si un vendeur change de numéro, le patron le
 * désactive et en invite un nouveau. `AuthRepository` n'étant pas tenant-scopé
 * (voir ARCHITECTURE.md), la cible est explicitement vérifiée ici, comme pour
 * deactivate-vendeur.use-case.ts.
 */
export async function updateVendeur(
  context: TenantContext,
  deps: { repository: AuthRepository; auditLogger: AuditLogger },
  input: { vendeurId: string; name: string },
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut modifier un vendeur");
  }

  const name = input.name.trim();
  if (!name) {
    throw new ValidationError("Le nom du vendeur est requis");
  }

  const vendeur = await deps.repository.findUserById(input.vendeurId);
  if (!vendeur || vendeur.tenantId !== context.tenantId || vendeur.role !== "VENDEUR") {
    throw new NotFoundError("User", input.vendeurId);
  }

  await deps.repository.updateName(vendeur.id, name);

  await deps.auditLogger.log(context, {
    action: "auth.vendeur_updated",
    entity: "User",
    entityId: vendeur.id,
    oldData: { name: vendeur.name },
    newData: { name },
  });
}
