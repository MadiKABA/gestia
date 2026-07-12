import type { TenantMessagingRepository } from "@/application/tenant/tenant-messaging.repository";

/** `null` si le tenant n'a jamais personnalisé un gabarit de reçu — les
 * gabarits par défaut vivent côté présentation (voir whatsapp-link.tsx),
 * jamais dupliqués ici. */
export async function getTenantWhatsappReceiptTemplates(deps: {
  repository: TenantMessagingRepository;
}): Promise<{ partial: string | null; final: string | null }> {
  return deps.repository.findWhatsappReceiptTemplates();
}
