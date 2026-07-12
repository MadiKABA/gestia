import type { TenantSettingsUpdateInput } from "@/domain/tenant-settings/tenant-settings.entity";

/** Objet settings complet — à la différence de TenantBrandingRepository/
 * TenantMessagingRepository (lectures étroites, ouvertes au VENDEUR), cette
 * interface est réservée à la page /parametres elle-même, qui doit préremplir
 * tous les champs à la fois. */
export type TenantSettingsFull = {
  displayName: string | null;
  currency: string;
  reminderDays: number;
  whatsappTemplate: string | null;
  brandColor: string | null;
  logoUrl: string | null;
};

export interface TenantSettingsRepository {
  findFull(): Promise<TenantSettingsFull | null>;
  update(input: TenantSettingsUpdateInput): Promise<TenantSettingsFull>;
}
