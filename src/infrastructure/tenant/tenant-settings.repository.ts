import type {
  TenantBranding,
  TenantBrandingRepository,
} from "@/application/tenant/tenant-branding.repository";
import type { TenantMessagingRepository } from "@/application/tenant/tenant-messaging.repository";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

export class PrismaTenantSettingsRepository
  extends TenantScopedRepository
  implements TenantBrandingRepository, TenantMessagingRepository
{
  async findByTenant(): Promise<TenantBranding | null> {
    // Requêté depuis Tenant (pas TenantSettings) : `tenantName` doit rester
    // disponible même si la ligne TenantSettings n'existe pas encore pour ce
    // tenant, `settings` peut donc être `null` sans faire échouer l'appel.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: this.tenantId },
      include: { settings: true },
    });
    if (!tenant) return null;

    return {
      logoUrl: tenant.settings?.logoUrl ?? null,
      brandColor: tenant.settings?.brandColor ?? null,
      displayName: tenant.settings?.displayName ?? null,
      tenantName: tenant.name,
    };
  }

  async findWhatsappTemplate(): Promise<string | null> {
    const settings = await this.prisma.tenantSettings.findUnique({ where: this.scoped() });
    return settings?.whatsappTemplate ?? null;
  }
}
