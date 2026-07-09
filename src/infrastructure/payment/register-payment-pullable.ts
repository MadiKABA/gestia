import { registerPullableEntity } from "@/infrastructure/offline/pull-registry";

/** Branche l'entity "payment" sur le cycle de pull générique côté client —
 * même contrat que register-transaction-pullable.ts (fichier distinct de
 * register-payment-sync.ts, jamais bundlé avec Prisma). */
export function registerPaymentPullable(): void {
  registerPullableEntity("payment");
}
