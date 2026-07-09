import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { paymentMutationHandler } from "@/infrastructure/payment/payment-mutation-handler";
import { paymentSyncPayloadSchema } from "@/infrastructure/payment/payment-mutation.schema";
import { paymentPullHandler } from "@/infrastructure/payment/payment-pull-handler";

/** Branche l'entity "payment" sur les moteurs de sync génériques (push et
 * pull) — même contrat que register-transaction-sync.ts. */
export function registerPaymentSync(): void {
  registerMutationHandler("payment", paymentMutationHandler);
  registerMutationSchema("payment", paymentSyncPayloadSchema);
  registerPullHandler("payment", paymentPullHandler);
}
