import { ForbiddenError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { AuthRepository } from "@/application/auth/auth.repository";

/** Liste des vendeurs du tenant, réservée au patron (écran de gestion). */
export async function listVendeurs(context: TenantContext, deps: { repository: AuthRepository }) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut consulter la liste des vendeurs");
  }

  return deps.repository.listVendeursByTenant(context.tenantId);
}
