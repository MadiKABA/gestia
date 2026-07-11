import { PaymentOfflineRepository } from "@/infrastructure/payment/payment-offline.repository";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import type { Payment } from "@/domain/payment/payment.entity";
import {
  syncTransport,
  triggerBackgroundSync,
} from "@/presentation/shared/hooks/use-network-status";

const ENTITY = "payment";

/** Composition root du repository offline Payment — voir
 * presentation/transaction/offline-repository.ts pour le même rôle côté Transaction. */
export function createPaymentOfflineRepository(
  tenantId: string,
  userId: string,
): PaymentOfflineRepository {
  return new PaymentOfflineRepository({
    tenantId,
    userId,
    syncTransport,
    onSyncNeeded: () => triggerBackgroundSync(tenantId),
  });
}

/** Amorce le cache local avec les paiements déjà rendus côté serveur (SSR)
 * — même rôle que seedTransactionCache. */
export async function seedPaymentCache(tenantId: string, payments: Payment[]): Promise<void> {
  await Promise.all(
    payments.map((payment) =>
      setCachedEntity(tenantId, ENTITY, payment.id, payment, payment.createdAt.toISOString()),
    ),
  );
}
