"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import { PrismaTenantSettingsRepository } from "@/infrastructure/tenant/tenant-settings.repository";
import { getTenantBranding } from "@/application/tenant/get-tenant-branding.use-case";
import { getTenantWhatsappTemplate } from "@/application/tenant/get-tenant-whatsapp-template.use-case";

export async function getTenantBrandingAction() {
  const context = await requireTenantContext();
  const repository = new PrismaTenantSettingsRepository(context.tenantId);
  return getTenantBranding(context, { repository });
}

export async function getTenantWhatsappTemplateAction() {
  const context = await requireTenantContext();
  const repository = new PrismaTenantSettingsRepository(context.tenantId);
  return getTenantWhatsappTemplate({ repository });
}
