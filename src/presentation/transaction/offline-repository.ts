import { TransactionOfflineRepository } from "@/infrastructure/transaction/transaction-offline.repository";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import type { Transaction } from "@/domain/transaction/transaction.entity";
import {
  syncTransport,
  triggerBackgroundSync,
} from "@/presentation/shared/hooks/use-network-status";

const ENTITY = "transaction";

/** Composition root du repository offline Transaction — voir
 * presentation/party/offline-repository.ts pour le même rôle côté Party. */
export function createTransactionOfflineRepository(
  tenantId: string,
  userId: string,
  onOfflineFallback?: () => void,
): TransactionOfflineRepository {
  return new TransactionOfflineRepository({
    tenantId,
    userId,
    syncTransport,
    onSyncNeeded: () => triggerBackgroundSync(tenantId),
    onOfflineFallback,
  });
}

/** Amorce le cache local avec les données fraîchement rendues côté serveur
 * (SSR) — pour qu'une prochaine visite hors ligne les retrouve déjà là. */
export async function seedTransactionCache(
  tenantId: string,
  transactions: Transaction[],
): Promise<void> {
  await Promise.all(
    transactions.map((transaction) =>
      setCachedEntity(
        tenantId,
        ENTITY,
        transaction.id,
        transaction,
        transaction.updatedAt.toISOString(),
      ),
    ),
  );
}
