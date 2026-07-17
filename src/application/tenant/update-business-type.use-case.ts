import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError, ValidationError } from "@/domain/shared/errors";
import { isBusinessTypeCode, type BusinessTypeCode } from "@/domain/tenant/business-type";
import type { TenantRepository } from "@/application/tenant/tenant.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

/** `businessType` vit sur `Tenant`, pas `TenantSettings` : ne passe donc pas
 * par `updateTenantSettings`, avec sa propre clé d'audit dédiée. */
export async function updateBusinessType(
  context: TenantContext,
  deps: { repository: TenantRepository; auditLogger: AuditLogger },
  businessType: BusinessTypeCode,
): Promise<BusinessTypeCode> {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut modifier le type de commerce de la boutique");
  }
  if (!isBusinessTypeCode(businessType)) {
    throw new ValidationError("Type de commerce invalide");
  }

  const oldBusinessType = await deps.repository.findBusinessType();
  const updated = await deps.repository.updateBusinessType(businessType);

  await deps.auditLogger.log(context, {
    action: "tenant.business_type_updated",
    entity: "Tenant",
    entityId: context.tenantId,
    oldData: { businessType: oldBusinessType },
    newData: { businessType: updated },
  });

  return updated;
}
