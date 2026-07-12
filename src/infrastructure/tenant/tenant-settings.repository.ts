import type {
  TenantBranding,
  TenantBrandingRepository,
} from "@/application/tenant/tenant-branding.repository";
import type { TenantMessagingRepository } from "@/application/tenant/tenant-messaging.repository";
import type {
  TenantSettingsFull,
  TenantSettingsRepository,
} from "@/application/tenant/tenant-settings.repository";
import type { TenantSettingsUpdateInput } from "@/domain/tenant-settings/tenant-settings.entity";
import { TenantScopedRepository } from "@/infrastructure/prisma/tenant-scoped-repository";

export class PrismaTenantSettingsRepository
  extends TenantScopedRepository
  implements TenantBrandingRepository, TenantMessagingRepository, TenantSettingsRepository
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

  async findFull(): Promise<TenantSettingsFull | null> {
    const settings = await this.prisma.tenantSettings.findUnique({ where: this.scoped() });
    if (!settings) return null;
    return {
      displayName: settings.displayName,
      currency: settings.currency,
      reminderDays: settings.reminderDays,
      whatsappTemplate: settings.whatsappTemplate,
      brandColor: settings.brandColor,
      logoUrl: settings.logoUrl,
    };
  }

  /**
   * `upsert` plutôt qu'`update` nu : défensif si la ligne TenantSettings
   * manquait (ne devrait jamais arriver, elle est créée à l'inscription —
   * voir auth.repository.ts), pour éviter un P2025 en pleine sauvegarde de
   * paramètres plutôt qu'une vraie 500 pour un cas qu'on ne veut pas déboguer
   * en prod. Les valeurs de `create` reprennent les défauts du schéma Prisma.
   */
  async update(input: TenantSettingsUpdateInput): Promise<TenantSettingsFull> {
    const settings = await this.prisma.tenantSettings.upsert({
      where: this.scoped(),
      update: input,
      create: {
        tenantId: this.tenantId,
        currency: input.currency ?? "FCFA",
        reminderDays: input.reminderDays ?? 7,
        whatsappTemplate: input.whatsappTemplate ?? null,
        brandColor: input.brandColor ?? "#0F2A4A",
        logoUrl: input.logoUrl ?? null,
        displayName: input.displayName ?? null,
      },
    });
    return {
      displayName: settings.displayName,
      currency: settings.currency,
      reminderDays: settings.reminderDays,
      whatsappTemplate: settings.whatsappTemplate,
      brandColor: settings.brandColor,
      logoUrl: settings.logoUrl,
    };
  }
}
