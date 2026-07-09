import type { TenantMessagingRepository } from "@/application/tenant/tenant-messaging.repository";

/** `null` si le tenant n'a jamais personnalisé son message de relance — le
 * gabarit par défaut vit côté présentation (voir whatsapp-link.tsx), jamais
 * dupliqué ici. */
export async function getTenantWhatsappTemplate(deps: {
  repository: TenantMessagingRepository;
}): Promise<string | null> {
  return deps.repository.findWhatsappTemplate();
}
