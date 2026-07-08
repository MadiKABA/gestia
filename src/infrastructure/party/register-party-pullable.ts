import { registerPullableEntity } from "@/infrastructure/offline/pull-registry";

/**
 * Branche l'entity "party" sur le cycle de pull générique côté client —
 * appelé une fois au montage de l'app (voir app-shell.tsx). Fichier distinct
 * de register-party-sync.ts : celui-ci ne doit jamais importer Prisma
 * (bundle client), contrairement à register-party-sync.ts qui reste
 * serveur-only (voir instrumentation.ts).
 */
export function registerPartyPullable(): void {
  registerPullableEntity("party");
}
