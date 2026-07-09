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
    const settings = await this.prisma.tenantSettings.findUnique({ where: this.scoped() });
    if (!settings) return null;

    return {
      logoUrl: settings.logoUrl,
      brandColor: settings.brandColor,
      displayName: settings.displayName,
    };
  }

  async findWhatsappTemplate(): Promise<string | null> {
    const settings = await this.prisma.tenantSettings.findUnique({ where: this.scoped() });
    return settings?.whatsappTemplate ?? null;
  }
}
