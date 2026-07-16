import type { CurrencyCode } from "@/config/currencies";

export type TenantBranding = {
  logoUrl: string | null;
  brandColor: string | null;
  displayName: string | null;
  /** Nom légal du tenant (`Tenant.name`) — secours de `displayName` pour le
   * titre affiché en haut de la sidebar (voir sidebar-fixed.tsx). */
  tenantName: string;
  /** Devise du tenant (`TenantSettings.currency`) — ajoutée ici plutôt que
   * dans un read-model dédié : c'est déjà le point de lecture léger fetché
   * par toute page qui affiche un montant ou construit un lien WhatsApp. */
  currency: CurrencyCode;
};

export interface TenantBrandingRepository {
  findByTenant(): Promise<TenantBranding | null>;
}
