import { CashMovementOfflineRepository } from "@/infrastructure/cash-movement/cash-movement-offline.repository";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import type { CashMovement } from "@/domain/cash-movement/cash-movement.entity";
import { triggerBackgroundSync } from "@/presentation/shared/hooks/use-network-status";

const ENTITY = "cashMovement";

/** Composition root du repository offline CashMovement — même rôle que
 * presentation/payment/offline-repository.ts côté Payment. */
export function createCashMovementOfflineRepository(
  tenantId: string,
  userId: string,
): CashMovementOfflineRepository {
  return new CashMovementOfflineRepository({
    tenantId,
    userId,
    onSyncNeeded: () => triggerBackgroundSync(tenantId),
  });
}

/** Amorce le cache local avec les mouvements déjà rendus côté serveur (SSR)
 * — même rôle que seedPaymentCache/seedTransactionCache. */
export async function seedCashMovementCache(
  tenantId: string,
  movements: CashMovement[],
): Promise<void> {
  await Promise.all(
    movements.map((movement) =>
      setCachedEntity(tenantId, ENTITY, movement.id, movement, movement.date.toISOString()),
    ),
  );
}
