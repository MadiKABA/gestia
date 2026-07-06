import type { TenantContext } from "@/domain/shared/tenant-context";
import type {
  TenantBranding,
  TenantBrandingRepository,
} from "@/application/tenant/tenant-branding.repository";

/** Habillage tenant pour le header (logo, couleur, nom affiché) — lecture
 * seule, aucune mutation donc pas d'entrée AuditLog. */
export async function getTenantBranding(
  context: TenantContext,
  deps: { repository: TenantBrandingRepository },
): Promise<TenantBranding> {
  const branding = await deps.repository.findByTenant();
  return branding ?? { logoUrl: null, brandColor: null, displayName: null };
}
