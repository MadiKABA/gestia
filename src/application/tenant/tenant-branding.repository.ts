export type TenantBranding = {
  logoUrl: string | null;
  brandColor: string | null;
  displayName: string | null;
  /** Nom légal du tenant (`Tenant.name`) — secours de `displayName` pour le
   * titre affiché en haut de la sidebar (voir sidebar-fixed.tsx). */
  tenantName: string;
};

export interface TenantBrandingRepository {
  findByTenant(): Promise<TenantBranding | null>;
}
