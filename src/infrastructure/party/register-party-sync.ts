import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { partyMutationHandler } from "@/infrastructure/party/party-mutation-handler";

/** Branche l'entity "party" sur le moteur de sync générique — importé une
 * fois au démarrage du serveur, voir src/instrumentation.ts. */
export function registerPartySync(): void {
  registerMutationHandler("party", partyMutationHandler);
}
