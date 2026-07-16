import type { TenantContext } from "@/domain/shared/tenant-context";
import type {
  TenantBranding,
  TenantBrandingRepository,
} from "@/application/tenant/tenant-branding.repository";
import { DEFAULT_CURRENCY } from "@/config/currencies";

/** Habillage tenant pour le header (logo, couleur, nom affiché) — lecture
 * seule, aucune mutation donc pas d'entrée AuditLog. */
export async function getTenantBranding(
  context: TenantContext,
  deps: { repository: TenantBrandingRepository },
): Promise<TenantBranding> {
  const branding = await deps.repository.findByTenant();
  // Ne se produit jamais en pratique (context.tenantId provient d'une session
  // valide, donc le tenant existe toujours) — secours defensif uniquement.
  return (
    branding ?? {
      logoUrl: null,
      brandColor: null,
      displayName: null,
      tenantName: "",
      currency: DEFAULT_CURRENCY,
    }
  );
}
