export type TenantBranding = {
  logoUrl: string | null;
  brandColor: string | null;
  displayName: string | null;
};

export interface TenantBrandingRepository {
  findByTenant(): Promise<TenantBranding | null>;
}
