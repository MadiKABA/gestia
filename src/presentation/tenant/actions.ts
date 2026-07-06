"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import { PrismaTenantSettingsRepository } from "@/infrastructure/tenant/tenant-settings.repository";
import { getTenantBranding } from "@/application/tenant/get-tenant-branding.use-case";

export async function getTenantBrandingAction() {
  const context = await requireTenantContext();
  const repository = new PrismaTenantSettingsRepository(context.tenantId);
  return getTenantBranding(context, { repository });
}
