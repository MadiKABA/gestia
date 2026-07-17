import type { BusinessTypeCode } from "@/domain/tenant/business-type";

/** `businessType` vit sur `Tenant` (pas `TenantSettings`) — repository dédié
 * plutôt qu'une extension de `TenantSettingsRepository`. */
export interface TenantRepository {
  findBusinessType(): Promise<BusinessTypeCode>;
  updateBusinessType(businessType: BusinessTypeCode): Promise<BusinessTypeCode>;
}
