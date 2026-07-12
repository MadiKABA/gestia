import type { TenantContext } from "@/domain/shared/tenant-context";
import { ForbiddenError } from "@/domain/shared/errors";
import type {
  TenantSettingsFull,
  TenantSettingsRepository,
} from "@/application/tenant/tenant-settings.repository";

const EMPTY_SETTINGS: TenantSettingsFull = {
  displayName: null,
  currency: "FCFA",
  reminderDays: 7,
  whatsappTemplate: null,
  whatsappReceiptPartialTemplate: null,
  whatsappReceiptFinalTemplate: null,
  brandColor: "#0F2A4A",
  logoUrl: null,
};

/** Lecture complète des paramètres pour préremplir le formulaire /parametres —
 * réservée au PATRON, à la différence de TenantBrandingRepository/
 * TenantMessagingRepository (lectures étroites ouvertes au VENDEUR) : cet
 * objet expose la devise et le template brut, sans consommateur VENDEUR
 * légitime. */
export async function getTenantSettingsForEdit(
  context: TenantContext,
  deps: { repository: TenantSettingsRepository },
): Promise<TenantSettingsFull> {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut consulter les paramètres de la boutique");
  }

  const settings = await deps.repository.findFull();
  // Ne se produit jamais en pratique (TenantSettings créé à l'inscription) —
  // secours defensif uniquement, même logique que getTenantBranding.
  return settings ?? EMPTY_SETTINGS;
}
