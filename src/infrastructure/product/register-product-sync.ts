import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { productMutationHandler } from "@/infrastructure/product/product-mutation-handler";
import { productSyncPayloadSchema } from "@/infrastructure/product/product-mutation.schema";
import { productPullHandler } from "@/infrastructure/product/product-pull-handler";

/** Branche l'entity "product" sur les moteurs de sync génériques (push et
 * pull) — importé une fois au démarrage du serveur, voir
 * src/instrumentation.ts. */
export function registerProductSync(): void {
  registerMutationHandler("product", productMutationHandler);
  registerMutationSchema("product", productSyncPayloadSchema);
  registerPullHandler("product", productPullHandler);
}
