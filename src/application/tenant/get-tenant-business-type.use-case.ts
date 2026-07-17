import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError } from "@/domain/shared/errors";
import type { TenantRepository } from "@/application/tenant/tenant.repository";
import type { BusinessTypeCode } from "@/domain/tenant/business-type";

/** Réservé au PATRON, même règle que `getTenantSettingsForEdit` — la
 * modification du type de commerce n'est pas une donnée VENDEUR. */
export async function getTenantBusinessType(
  context: TenantContext,
  deps: { repository: TenantRepository },
): Promise<BusinessTypeCode> {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut consulter le type de commerce de la boutique");
  }

  return deps.repository.findBusinessType();
}
