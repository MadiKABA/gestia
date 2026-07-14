import type { OfflineFirstRepository } from "@/application/offline/offline-first-repository";
import type { TransactionSearchQuery } from "@/application/transaction/transaction.repository";
import {
  deriveTransactionStatus,
  validateTransactionInput,
  type Transaction,
  type TransactionInput,
} from "@/domain/transaction/transaction.entity";
import { ValidationError } from "@/domain/shared/errors";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncTransport } from "@/infrastructure/offline/sync-engine";
import { attemptOnlineMutation } from "@/infrastructure/offline/online-first-mutation";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import {
  getCachedEntity,
  listCachedEntities,
  removeCachedEntity,
  setCachedEntity,
} from "@/infrastructure/offline/local-cache.store";
import { enqueueMutation } from "@/infrastructure/offline/mutation-queue.store";
import { isOnline } from "@/infrastructure/offline/platform";

const ENTITY = "transaction";

export type TransactionOfflineDeps = {
  tenantId: string;
  userId: string;
  /** Même transport que la sync différée — voir PartyOfflineRepository
   * (optionnel : absent, la tentative directe est simplement sautée). */
  syncTransport?: SyncTransport;
  /** Non bloquant, jamais attendu par l'appelant — voir PartyOfflineRepository. */
  onSyncNeeded?: () => void;
  /** Appelé uniquement en repli sur la queue de sync — voir PartyOfflineRepository. */
  onOfflineFallback?: () => void;
};

/**
 * Repository "online-first, repli offline" du module Transaction
 * (créances/dettes, cahier des charges §8), même pattern que
 * PartyOfflineRepository (tentative directe contre le serveur si en ligne,
 * repli sur cache + mutationQueue seulement en cas d'échec transitoire —
 * voir attemptOnlineMutation). Deux écarts assumés par rapport à Party :
 *
 * - `reference` (CR-2026-XXXXX / DT-2026-XXXXX) ne peut jamais être générée
 *   hors ligne (compteur atomique par tenant/année, voir
 *   infrastructure/transaction/transaction.repository.ts) : l'objet
 *   optimiste local la pose à `null`, y compris pour une tentative directe
 *   en ligne réussie — le cycle de sync enchaîne toujours push puis pull
 *   dans la même passe (network-status-store.ts:runSync), donc la vraie
 *   référence arrive via le pull générique existant juste après.
 * - `status`/`paidAmount` sont dérivés, jamais des entrées utilisateur :
 *   posés en dur ici (paidAmount toujours 0, module Payment hors périmètre
 *   de ce retrofit) plutôt que lus depuis TransactionInput.
 *
 * `update()` reçoit `TransactionInput` (avec `partyId`), pas
 * `TransactionUpdateInput` : `OfflineFirstRepository<T, TInput>` partage un
 * seul `TInput` entre create/update, et le moteur de sync générique résout
 * un seul schéma Zod par entity, quelle que soit l'action
 * (sync-mutation.use-case.ts, jamais modifié pour Transaction) — le payload
 * de mutation `update` doit donc avoir la même forme que `create`.
 * `partyId` reçu ici est ignoré (le tiers reste toujours celui du cache
 * local, jamais celui envoyé par le formulaire) : immuabilité appliquée
 * silencieusement, symétrique à la validation stricte côté serveur
 * (update-transaction.use-case.ts prend TransactionUpdateInput, sans
 * `partyId` du tout).
 */
export class TransactionOfflineRepository implements OfflineFirstRepository<
  Transaction,
  TransactionInput,
  TransactionSearchQuery
> {
  constructor(private readonly deps: TransactionOfflineDeps) {}

  async create(input: TransactionInput): Promise<Transaction> {
    validateTransactionInput(input);

    const id = generateClientId();
    const now = new Date();
    const transaction: Transaction = {
      id,
      tenantId: this.deps.tenantId,
      reference: null,
      partyId: input.partyId,
      type: input.type,
      description: input.description,
      quantity: input.quantity ?? null,
      amount: input.amount,
      paidAmount: 0,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      status: "EN_COURS",
      createdById: this.deps.userId,
      createdAt: now,
      updatedAt: now,
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
      if (result.status === "validation_error" || result.status === "dependency_not_found") {
        // Une tentative en ligne est déjà séquentielle et complète : pas de
        // "prochaine mutation en queue" qui pourrait encore résoudre la
        // dépendance manquante, contrairement à sync-engine.ts — voir
        // online-first-mutation.ts.
        throw new ValidationError(result.message);
      }
      if (result.status === "success") {
        const confirmed = { ...transaction, updatedAt: new Date(result.updatedAt) };
        await setCachedEntity(this.deps.tenantId, ENTITY, id, confirmed, result.updatedAt);
        this.deps.onSyncNeeded?.(); // reference réelle (CR-/DT-) rapatriée par le pull qui suit
        return confirmed;
      }
      // "transient_error" : repli sur le chemin hors ligne ci-dessous.
    }

    await setCachedEntity(this.deps.tenantId, ENTITY, id, transaction, now.toISOString());
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
    this.deps.onOfflineFallback?.();

    return transaction;
  }

  async update(id: string, input: TransactionInput): Promise<Transaction> {
    validateTransactionInput(input);

    const cached = await getCachedEntity<Transaction>(this.deps.tenantId, ENTITY, id);
    const now = new Date();
    const partyId = cached?.data.partyId ?? input.partyId;
    const updated: Transaction = {
      id,
      tenantId: this.deps.tenantId,
      // `reference`/`createdById`/`createdAt` inchangés — jamais réédités.
      // `partyId` reste celui déjà connu localement, jamais celui du
      // formulaire (immuable, voir le commentaire de classe ci-dessus).
      reference: cached?.data.reference ?? null,
      partyId,
      createdById: cached?.data.createdById ?? this.deps.userId,
      createdAt: cached?.data.createdAt ?? now,
      paidAmount: cached?.data.paidAmount ?? 0,
      type: input.type,
      description: input.description,
      quantity: input.quantity ?? null,
      amount: input.amount,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      status: deriveTransactionStatus(input.amount, cached?.data.paidAmount ?? 0),
      updatedAt: now,
    };
    const knownServerUpdatedAt = cached?.updatedAt ?? now.toISOString();
    const payload = { ...input, partyId };

    if (isOnline() && this.deps.syncTransport) {
      const mutation: QueuedMutation = {
        id: generateClientId(),
        tenantId: this.deps.tenantId,
        entity: ENTITY,
        action: "update",
        payload,
        clientGeneratedId: id,
        clientKnownUpdatedAt: knownServerUpdatedAt,
        createdAt: now.toISOString(),
        createdById: this.deps.userId,
      };
      const result = await attemptOnlineMutation(this.deps.syncTransport, mutation);
      if (result.status === "validation_error") {
        throw new ValidationError(result.message);
      }
      if (result.status === "success") {
        const confirmed = { ...updated, updatedAt: new Date(result.updatedAt) };
        await setCachedEntity(this.deps.tenantId, ENTITY, id, confirmed, result.updatedAt);
        this.deps.onSyncNeeded?.();
        return confirmed;
      }
    }

    // Même règle que PartyOfflineRepository.update : le `updatedAt` du
    // RECORD de cache reste le dernier `updatedAt` confirmé par le
    // serveur, jamais celui de cette édition locale optimiste.
    await setCachedEntity(this.deps.tenantId, ENTITY, id, updated, knownServerUpdatedAt);
    await enqueueMutation({
      id: generateClientId(),
      tenantId: this.deps.tenantId,
      entity: ENTITY,
      action: "update",
      payload,
      clientGeneratedId: id,
      createdById: this.deps.userId,
    });
    this.deps.onSyncNeeded?.();
    this.deps.onOfflineFallback?.();

    return updated;
  }

  async delete(id: string): Promise<void> {
    const cached = await getCachedEntity<Transaction>(this.deps.tenantId, ENTITY, id);

    if (isOnline() && this.deps.syncTransport) {
      const mutation: QueuedMutation = {
        id: generateClientId(),
        tenantId: this.deps.tenantId,
        entity: ENTITY,
        action: "delete",
        payload: {},
        clientGeneratedId: id,
        clientKnownUpdatedAt: cached?.updatedAt,
        createdAt: new Date().toISOString(),
        createdById: this.deps.userId,
      };
      const result = await attemptOnlineMutation(this.deps.syncTransport, mutation);
      if (result.status === "validation_error") {
        throw new ValidationError(result.message);
      }
      if (result.status === "success") {
        await removeCachedEntity(this.deps.tenantId, ENTITY, id);
        this.deps.onSyncNeeded?.();
        return;
      }
    }

    await removeCachedEntity(this.deps.tenantId, ENTITY, id);
    await enqueueMutation({
      id: generateClientId(),
      tenantId: this.deps.tenantId,
      entity: ENTITY,
      action: "delete",
      payload: {},
      clientGeneratedId: id,
      createdById: this.deps.userId,
      clientKnownUpdatedAt: cached?.updatedAt,
    });
    this.deps.onSyncNeeded?.();
  }

  async getById(id: string): Promise<Transaction | null> {
    const cached = await getCachedEntity<Transaction>(this.deps.tenantId, ENTITY, id);
    if (isOnline()) this.deps.onSyncNeeded?.();
    return cached?.data ?? null;
  }

  async list(filters: TransactionSearchQuery): Promise<Transaction[]> {
    const cached = await listCachedEntities<Transaction>(this.deps.tenantId, ENTITY);
    const filtered = applyLocalFilters(
      cached.map((c) => c.data),
      filters,
    );

    if (isOnline()) this.deps.onSyncNeeded?.();

    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

function applyLocalFilters(
  transactions: Transaction[],
  filters: TransactionSearchQuery,
): Transaction[] {
  return transactions.filter((transaction) => {
    if (filters.partyId && transaction.partyId !== filters.partyId) return false;
    if (filters.type && transaction.type !== filters.type) return false;
    if (filters.status && transaction.status !== filters.status) return false;
    if (filters.search) {
      const term = filters.search.toLowerCase();
      if (!transaction.description.toLowerCase().includes(term)) return false;
    }
    return true;
  });
}
