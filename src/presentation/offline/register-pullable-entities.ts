import { registerPartyPullable } from "@/infrastructure/party/register-party-pullable";
import { registerTransactionPullable } from "@/infrastructure/transaction/register-transaction-pullable";
import { registerPaymentPullable } from "@/infrastructure/payment/register-payment-pullable";
import { registerCashMovementPullable } from "@/infrastructure/cash-movement/register-cash-movement-pullable";

/**
 * Orchestrateur client des entities à rafraîchir par pull — symétrique à
 * `registerPartySync` (src/infrastructure/party/register-party-sync.ts),
 * appelé côté serveur par src/instrumentation.ts. Appelé une fois au
 * montage de AppShell (layout applicatif, monté pour toute page du
 * dashboard) : le layout générique n'a ainsi jamais besoin de connaître
 * "party" ou tout futur module métier lui-même.
 */
export function registerPullableEntities(): void {
  registerPartyPullable();
  registerTransactionPullable();
  registerPaymentPullable();
  registerCashMovementPullable();
}
