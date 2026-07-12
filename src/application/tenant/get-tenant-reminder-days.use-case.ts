import type { TenantMessagingRepository } from "@/application/tenant/tenant-messaging.repository";

/** Lecture étroite, ouverte au VENDEUR (même pattern que
 * getTenantWhatsappTemplate) — consommée pour calculer le badge "à relancer"
 * sur les écrans créances/dettes (voir domain/transaction/transaction.entity.ts
 * `isEligibleForReminder`). */
export async function getTenantReminderDays(deps: {
  repository: TenantMessagingRepository;
}): Promise<number> {
  return deps.repository.findReminderDays();
}
