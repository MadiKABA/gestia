import { registerPullableEntity } from "@/infrastructure/offline/pull-registry";

/** Branche l'entity "cashMovement" sur le cycle de pull générique côté
 * client — même contrat que register-payment-pullable.ts (fichier distinct
 * de register-cash-movement-sync.ts, jamais bundlé avec Prisma). */
export function registerCashMovementPullable(): void {
  registerPullableEntity("cashMovement");
}
