import { registerPullableEntity } from "@/infrastructure/offline/pull-registry";

/** Branche l'entity "transaction" sur le cycle de pull générique côté
 * client — même contrat que register-party-pullable.ts (fichier distinct
 * de register-transaction-sync.ts, jamais bundlé avec Prisma). */
export function registerTransactionPullable(): void {
  registerPullableEntity("transaction");
}
