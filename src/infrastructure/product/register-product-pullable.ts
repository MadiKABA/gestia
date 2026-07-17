import { registerPullableEntity } from "@/infrastructure/offline/pull-registry";

/** Branche l'entity "product" sur le cycle de pull générique côté client —
 * appelé une fois au montage de l'app (voir register-pullable-entities.ts).
 * Fichier distinct de register-product-sync.ts : celui-ci ne doit jamais
 * importer Prisma (bundle client). */
export function registerProductPullable(): void {
  registerPullableEntity("product");
}
