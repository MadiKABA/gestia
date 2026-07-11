import type { CashMovement, CashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import { validateCashMovementInput } from "@/domain/cash-movement/cash-movement.entity";
import { ValidationError } from "@/domain/shared/errors";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncTransport } from "@/infrastructure/offline/sync-engine";
import { attemptOnlineMutation } from "@/infrastructure/offline/online-first-mutation";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import {
  getCachedEntity,
  listCachedEntities,
  setCachedEntity,
} from "@/infrastructure/offline/local-cache.store";
import { enqueueMutation } from "@/infrastructure/offline/mutation-queue.store";
import { isOnline } from "@/infrastructure/offline/platform";

const ENTITY = "cashMovement";

export type CashMovementOfflineDeps = {
  tenantId: string;
  userId: string;
  /** Même transport que la sync différée — voir PartyOfflineRepository
   * (optionnel : absent, la tentative directe est simplement sautée). */
  syncTransport?: SyncTransport;
  /** Non bloquant, jamais attendu par l'appelant — voir TransactionOfflineRepository. */
  onSyncNeeded?: () => void;
};

/**
 * Repository "online-first, repli offline" du module CashMovement. Dévie
 * volontairement de `OfflineFirstRepository<T, TInput, TFilters>` (voir
 * PaymentOfflineRepository, même rationale) : un mouvement de caisse n'a ni
 * `update` ni `delete` côté UI — ledger append-only, jamais modifié ni
 * supprimé une fois enregistré.
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

    if (isOnline() && this.deps.syncTransport) {
      const mutation: QueuedMutation = {
        id: generateClientId(),
        tenantId: this.deps.tenantId,
        entity: ENTITY,
        action: "create",
        payload: input,
        clientGeneratedId: id,
        createdAt: now.toISOString(),
        createdById: this.deps.userId,
      };
      const result = await attemptOnlineMutation(this.deps.syncTransport, mutation);
      if (result.status === "validation_error") {
        throw new ValidationError(result.message);
      }
      if (result.status === "success") {
        const confirmed = { ...movement, date: new Date(result.updatedAt) };
        await setCachedEntity(this.deps.tenantId, ENTITY, id, confirmed, result.updatedAt);
        this.deps.onSyncNeeded?.();
        return confirmed;
      }
      // "transient_error" : repli sur le chemin hors ligne ci-dessous.
    }

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
