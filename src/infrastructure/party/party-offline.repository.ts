import type { OfflineFirstRepository } from "@/application/offline/offline-first-repository";
import { validatePartyInput, type PartyInput } from "@/domain/party/party.entity";
import type { PartySearchQuery, PartyWithBalance } from "@/application/party/party.repository";
import { generateClientId } from "@/infrastructure/offline/id-generator";
import {
  getCachedEntity,
  listCachedEntities,
  removeCachedEntity,
  setCachedEntity,
} from "@/infrastructure/offline/local-cache.store";
import { enqueueMutation } from "@/infrastructure/offline/mutation-queue.store";

const ENTITY = "party";

export type PartyOfflineDeps = {
  tenantId: string;
  userId: string;
  /** Nudge non bloquant, jamais attendu par l'appelant — déclenche plus tôt
   * un cycle de sync (push puis pull générique, cf. party-pull-handler.ts)
   * déjà prévu par ailleurs (online/visibilitychange/polling), aussi bien
   * après une mutation locale qu'avant de servir une lecture en ligne. Voir
   * presentation/shared/hooks/use-network-status.ts:triggerBackgroundSync.
   * Injecté plutôt qu'importé : infrastructure/ ne dépend jamais de
   * presentation/. */
  onSyncNeeded?: () => void;
};

/**
 * Repository offline-first du module Party (cahier des charges §9) : lit et
 * écrit le cache local IndexedDB en priorité, enfile les mutations dans la
 * queue de sync générique plutôt que d'appeler Prisma ou une Server Action
 * de mutation directement. La cible serveur réelle (appelée uniquement à la
 * synchronisation) vit dans party-mutation-handler.ts.
 *
 * Le rafraîchissement des lectures (`getById`/`list`) ne fait plus l'objet
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

    // Le `updatedAt` du RECORD de cache (dernier paramètre) doit rester la
    // dernière valeur confirmée par le serveur, jamais celle de cette
    // édition locale optimiste — sinon la détection de conflit à la sync se
    // compare à elle-même au lieu de comparer au dernier état serveur
    // réellement connu. `updated.updatedAt` (le champ de l'entité, affiché)
    // peut lui refléter l'édition locale sans problème.
    const knownServerUpdatedAt = cached?.updatedAt ?? now.toISOString();
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

    return updated;
  }

  async delete(id: string): Promise<void> {
    // Le cache local est retiré tout de suite (affichage instantané), mais
    // son `updatedAt` doit être capturé AVANT — le moteur de sync en a besoin
    // pour la détection de conflit et ne pourra plus le relire une fois le
    // cache vidé (voir MutationQueueRecord.clientKnownUpdatedAt).
    const cached = await getCachedEntity<PartyWithBalance>(this.deps.tenantId, ENTITY, id);
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

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
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
