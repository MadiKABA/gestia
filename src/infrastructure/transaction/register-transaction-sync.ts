import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { transactionMutationHandler } from "@/infrastructure/transaction/transaction-mutation-handler";
import { transactionSyncPayloadSchema } from "@/infrastructure/transaction/transaction-mutation.schema";
import { transactionPullHandler } from "@/infrastructure/transaction/transaction-pull-handler";

/** Branche l'entity "transaction" sur les moteurs de sync génériques (push
 * et pull) — même contrat que register-party-sync.ts. */
export function registerTransactionSync(): void {
  registerMutationHandler("transaction", transactionMutationHandler);
  registerMutationSchema("transaction", transactionSyncPayloadSchema);
  registerPullHandler("transaction", transactionPullHandler);
}
