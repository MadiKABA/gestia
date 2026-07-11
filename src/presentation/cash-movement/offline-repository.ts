import {
  CASH_BALANCE_CACHE_ID,
  CASH_BALANCE_ENTITY,
  CashMovementOfflineRepository,
} from "@/infrastructure/cash-movement/cash-movement-offline.repository";
import { getCachedEntity, setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import { isOnline } from "@/infrastructure/offline/platform";
import type { CashMovement } from "@/domain/cash-movement/cash-movement.entity";
import type { CashBalance } from "@/application/cash-movement/cash-movement.repository";
import {
  syncTransport,
  triggerBackgroundSync,
} from "@/presentation/shared/hooks/use-network-status";

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
    syncTransport,
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

/**
 * Amorce ou lit le cache du solde agrégé (`CASH_BALANCE_ENTITY`,
 * cash-movement-offline.repository.ts) selon l'état réseau au montage de la
 * page Caisse :
 * - en ligne, `initialBalance` (rendu serveur, forcément frais) écrase le
 *   cache — c'est la source de vérité la plus à jour possible ;
 * - hors ligne, le rendu servi peut provenir du cache du service worker
 *   (NetworkFirst, voir sw.ts) et donc précéder un mouvement créé localement
 *   depuis — ne JAMAIS écraser un cache plus frais avec cette valeur figée,
 *   se contenter de le lire (avec repli sur `initialBalance` si rien n'est
 *   encore en cache, ex. première visite).
 */
export async function seedOrReadCashBalanceCache(
  tenantId: string,
  initialBalance: CashBalance,
): Promise<CashBalance> {
  if (isOnline()) {
    await setCachedEntity(
      tenantId,
      CASH_BALANCE_ENTITY,
      CASH_BALANCE_CACHE_ID,
      initialBalance,
      new Date().toISOString(),
    );
    return initialBalance;
  }
  const cached = await getCachedEntity<CashBalance>(
    tenantId,
    CASH_BALANCE_ENTITY,
    CASH_BALANCE_CACHE_ID,
  );
  return cached?.data ?? initialBalance;
}
