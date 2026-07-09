import type { CashMovement, CashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import { validateCashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import {
  getCachedEntity,
  listCachedEntities,
  setCachedEntity,
} from "@/infrastructure/offline/local-cache.store";
import { enqueueMutation } from "@/infrastructure/offline/mutation-queue.store";

const ENTITY = "cashMovement";

export type CashMovementOfflineDeps = {
  tenantId: string;
  userId: string;
  /** Non bloquant, jamais attendu par l'appelant — voir TransactionOfflineRepository. */
  onSyncNeeded?: () => void;
};

/**
 * Repository offline-first du module CashMovement. Dévie volontairement de
 * `OfflineFirstRepository<T, TInput, TFilters>` (voir PaymentOfflineRepository,
 * même rationale) : un mouvement de caisse n'a ni `update` ni `delete` côté
 * UI — ledger append-only, jamais modifié ni supprimé une fois enregistré.
 */
export class CashMovementOfflineRepository {
  constructor(private readonly deps: CashMovementOfflineDeps) {}

  async create(input: CashMovementInput): Promise<CashMovement> {
    validateCashMovementInput(input);

    const id = generateClientId();
    const now = new Date();
    const movement: CashMovement = {
      id,
      tenantId: this.deps.tenantId,
      type: input.type,
      amount: input.amount,
      reason: input.reason,
      linkedPaymentId: null,
      createdById: this.deps.userId,
      date: now,
    };
    await setCachedEntity(this.deps.tenantId, ENTITY, id, movement, now.toISOString());

    await enqueueMutation({
      id: generateClientId(),
      tenantId: this.deps.tenantId,
      entity: ENTITY,
      action: "create",
      payload: input,
      clientGeneratedId: id,
      createdById: this.deps.userId,
    });
    this.deps.onSyncNeeded?.();

    return movement;
  }

  async getById(id: string): Promise<CashMovement | null> {
    const cached = await getCachedEntity<CashMovement>(this.deps.tenantId, ENTITY, id);
    return cached?.data ?? null;
  }

  /** Tous les mouvements en cache, tri chronologique décroissant — la
   * pagination (page suivante via Server Action) est gérée par l'appelant,
   * ce repository ne fait que refléter l'état local le plus à jour. */
  async list(): Promise<CashMovement[]> {
    const cached = await listCachedEntities<CashMovement>(this.deps.tenantId, ENTITY);
    return cached.map((c) => c.data).sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}
