import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { partyMutationHandler } from "@/infrastructure/party/party-mutation-handler";
import { partySyncPayloadSchema } from "@/infrastructure/party/party-mutation.schema";
import { partyPullHandler } from "@/infrastructure/party/party-pull-handler";

/** Branche l'entity "party" sur les moteurs de sync génériques (push et
 * pull) — importé une fois au démarrage du serveur, voir
 * src/instrumentation.ts. */
export function registerPartySync(): void {
  registerMutationHandler("party", partyMutationHandler);
  registerMutationSchema("party", partySyncPayloadSchema);
  registerPullHandler("party", partyPullHandler);
}
