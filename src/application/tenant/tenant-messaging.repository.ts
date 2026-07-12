/** Deuxième interface de lecture ciblée sur `TenantSettings` (même table que
 * TenantBrandingRepository, colonne différente) — pattern déjà établi pour
 * cette table : plusieurs interfaces de lecture étroites plutôt qu'un seul
 * gros type "settings". */
export interface TenantMessagingRepository {
  findWhatsappTemplate(): Promise<string | null>;
  findWhatsappReceiptTemplates(): Promise<{ partial: string | null; final: string | null }>;
}
