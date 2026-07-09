export async function register() {
  // Fail-fast : toute variable d'environnement manquante ou invalide arrête le
  // démarrage du serveur ici plutôt qu'en pleine requête (cahier des charges §9).
  await import("@/lib/env");

  // `register()` est bundlé pour Node ET Edge (le proxy tourne en Edge) —
  // les Server Actions qui utilisent réellement le registre de sync
  // s'exécutent toujours en Node (Prisma/pg n'est pas compatible Edge), donc
  // rien à brancher côté Edge. Sans cette garde, Prisma se retrouve importé
  // dans le bundle Edge et casse le build (node:path/node:url non supportés).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Branche chaque module métier sur le moteur de sync générique
    // (application/offline/mutation-handler-registry.ts) — une seule fois au
    // démarrage du serveur.
    const { registerPartySync } = await import("@/infrastructure/party/register-party-sync");
    registerPartySync();
    const { registerTransactionSync } =
      await import("@/infrastructure/transaction/register-transaction-sync");
    registerTransactionSync();
    const { registerPaymentSync } = await import("@/infrastructure/payment/register-payment-sync");
    registerPaymentSync();
    const { registerCashMovementSync } =
      await import("@/infrastructure/cash-movement/register-cash-movement-sync");
    registerCashMovementSync();
  }
}
