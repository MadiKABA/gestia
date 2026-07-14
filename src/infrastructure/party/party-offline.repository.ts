import type { OfflineFirstRepository } from "@/application/offline/offline-first-repository";
import { validatePartyInput, type PartyInput } from "@/domain/party/party.entity";
import { ValidationError } from "@/domain/shared/errors";
import type { PartySearchQuery, PartyWithBalance } from "@/application/party/party.repository";
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

const ENTITY = "party";

export type PartyOfflineDeps = {
  tenantId: string;
  userId: string;
  /** Même transport que la sync différée (sync-engine.ts) — tenté en
   * premier si l'app est en ligne au moment de l'action, avant tout repli
   * sur le cache local + la queue (voir attemptOnlineMutation). Optionnel :
   * absent, la tentative directe est simplement sautée (repli offline
   * immédiat) — utilisé par les tests d'intégration qui pilotent la queue
   * explicitement via `syncQueue`, sans jamais passer par un vrai
   * navigateur. */
  syncTransport?: SyncTransport;
  /** Nudge non bloquant, jamais attendu par l'appelant — déclenche plus tôt
   * un cycle de sync (push puis pull générique, cf. party-pull-handler.ts)
   * déjà prévu par ailleurs (online/visibilitychange/polling), aussi bien
   * après une mutation locale qu'avant de servir une lecture en ligne. Voir
   * presentation/shared/hooks/use-network-status.ts:triggerBackgroundSync.
   * Injecté plutôt qu'importé : infrastructure/ ne dépend jamais de
   * presentation/. */
  onSyncNeeded?: () => void;
  /** Appelé uniquement quand la tentative en ligne échoue pour une raison
   * transitoire et que la mutation retombe sur la queue de sync — jamais sur
   * le chemin de succès en ligne. Permet à l'appelant (toast, voir
   * presentation/shared/toast.ts) de distinguer les deux issues sans que
   * cette couche connaisse la notion de toast. */
  onOfflineFallback?: () => void;
};

/**
 * Repository "online-first, repli offline" du module Party (cahier des
 * charges §9) : si l'app est en ligne au moment de l'action, tente
 * d'abord une écriture directe contre le serveur réel (mêmes règles
 * métier que la sync différée — voir attemptOnlineMutation, qui appelle le
 * même transport que sync-engine.ts) et ne retombe sur le cache local +
 * mutationQueue que si cette tentative échoue pour une raison transitoire
 * (réseau, session expirée...). Hors ligne, comportement inchangé : cache
 * optimiste + enfilement + sync différée. La cible serveur réelle (appelée
 * à la fois par une tentative directe et par la sync différée) vit dans
 * party-mutation-handler.ts.
 *
 * Le rafraîchissement des lectures (`getById`/`list`) ne fait pas l'objet
 * d'un refetch ad hoc propre à Party : il passe par le même cycle de pull
 * générique que tout autre module retrofité sur cette couche (curseur
 * incrémental, pagination, soft-delete — party-pull-handler.ts), déjà
 * déclenché par online/visibilitychange/polling. `onSyncNeeded` ne fait que
 * demander un cycle plus tôt, jamais une requête dédiée à Party.
 *
 * Le solde (`balance`) n'est jamais recalculé ici : tant que le module
 * Transaction n'existe pas, il reste à 0 partout, exactement comme dans
 * PrismaPartyRepository.findMany — cette couche ne fait qu'y lire/écrire ce
 * qui existe déjà, jamais "deviner" une valeur.
 */
export class PartyOfflineRepository implements OfflineFirstRepository<
  PartyWithBalance,
  PartyInput,
  PartySearchQuery
> {
  constructor(private readonly deps: PartyOfflineDeps) {}

  async create(input: PartyInput): Promise<PartyWithBalance> {
    validatePartyInput(input);

    const id = generateClientId();
    const now = new Date();
    const party: PartyWithBalance = {
      id,
      tenantId: this.deps.tenantId,
      name: input.name,
      phone: input.phone ?? null,
      whatsappNumber: input.whatsappNumber ?? null,
      type: input.type,
      isCompany: input.isCompany ?? false,
      companyName: input.companyName ?? null,
      contactName: input.contactName ?? null,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
      balance: 0,
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
        const confirmed = { ...party, updatedAt: new Date(result.updatedAt) };
        await setCachedEntity(this.deps.tenantId, ENTITY, id, confirmed, result.updatedAt);
        this.deps.onSyncNeeded?.();
        return confirmed;
      }
      // "transient_error" : repli sur le chemin hors ligne ci-dessous, comme
      // si l'app avait été hors ligne dès le départ — aucune saisie perdue.
    }

    await setCachedEntity(this.deps.tenantId, ENTITY, id, party, now.toISOString());
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

    return party;
  }

  async update(id: string, input: PartyInput): Promise<PartyWithBalance> {
    validatePartyInput(input);

    const cached = await getCachedEntity<PartyWithBalance>(this.deps.tenantId, ENTITY, id);
    const now = new Date();
    const updated: PartyWithBalance = {
      id,
      tenantId: this.deps.tenantId,
      createdAt: cached?.data.createdAt ?? now,
      balance: cached?.data.balance ?? 0,
      name: input.name,
      phone: input.phone ?? null,
      whatsappNumber: input.whatsappNumber ?? null,
      type: input.type,
      isCompany: input.isCompany ?? false,
      companyName: input.companyName ?? null,
      contactName: input.contactName ?? null,
      note: input.note ?? null,
      updatedAt: now,
    };
    // Dernier `updatedAt` confirmé par le serveur connu du client — lu une
    // seule fois ici, utilisé à la fois pour la tentative directe en ligne
    // (clientKnownUpdatedAt, détection de conflit générique côté serveur,
    // voir sync-mutation.use-case.ts) et pour l'enfilement de repli.
    const knownServerUpdatedAt = cached?.updatedAt ?? now.toISOString();

    if (isOnline() && this.deps.syncTransport) {
      const mutation: QueuedMutation = {
        id: generateClientId(),
        tenantId: this.deps.tenantId,
        entity: ENTITY,
        action: "update",
        payload: input,
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

    // Le `updatedAt` du RECORD de cache (dernier paramètre) doit rester la
    // dernière valeur confirmée par le serveur, jamais celle de cette
    // édition locale optimiste — sinon la détection de conflit à la sync se
    // compare à elle-même au lieu de comparer au dernier état serveur
    // réellement connu. `updated.updatedAt` (le champ de l'entité, affiché)
    // peut lui refléter l'édition locale sans problème.
    await setCachedEntity(this.deps.tenantId, ENTITY, id, updated, knownServerUpdatedAt);
    await enqueueMutation({
      id: generateClientId(),
      tenantId: this.deps.tenantId,
      entity: ENTITY,
      action: "update",
      payload: input,
      clientGeneratedId: id,
      createdById: this.deps.userId,
    });
    this.deps.onSyncNeeded?.();
    this.deps.onOfflineFallback?.();

    return updated;
  }

  async delete(id: string): Promise<void> {
    // Le cache local et son `updatedAt` doivent être capturés AVANT toute
    // action — nécessaire à la fois pour la tentative directe en ligne
    // (clientKnownUpdatedAt) et, en repli, pour la mutation enfilée (le
    // moteur de sync différée ne pourra plus le relire une fois le cache
    // vidé, voir MutationQueueRecord.clientKnownUpdatedAt).
    const cached = await getCachedEntity<PartyWithBalance>(this.deps.tenantId, ENTITY, id);

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

  async getById(id: string): Promise<PartyWithBalance | null> {
    const cached = await getCachedEntity<PartyWithBalance>(this.deps.tenantId, ENTITY, id);
    if (isOnline()) this.deps.onSyncNeeded?.();
    return cached?.data ?? null;
  }

  async list(filters: PartySearchQuery): Promise<PartyWithBalance[]> {
    const cached = await listCachedEntities<PartyWithBalance>(this.deps.tenantId, ENTITY);
    const filtered = applyLocalFilters(
      cached.map((c) => c.data),
      filters,
    );

    if (isOnline()) this.deps.onSyncNeeded?.();

    return filtered.sort((a, b) => b.balance - a.balance);
  }
}

function applyLocalFilters(
  parties: PartyWithBalance[],
  filters: PartySearchQuery,
): PartyWithBalance[] {
  return parties.filter((party) => {
    if (filters.type && party.type !== filters.type) return false;
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const matchesName = party.name.toLowerCase().includes(term);
      const matchesPhone = party.phone?.includes(filters.search) ?? false;
      if (!matchesName && !matchesPhone) return false;
    }
    return true;
  });
}
