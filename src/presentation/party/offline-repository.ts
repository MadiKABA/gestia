import { PartyOfflineRepository } from "@/infrastructure/party/party-offline.repository";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import type { PartyWithBalance } from "@/application/party/party.repository";
import { getPartyByIdAction, searchPartiesAction } from "@/presentation/party/actions";
import { triggerBackgroundSync } from "@/presentation/shared/hooks/use-network-status";

const ENTITY = "party";

/**
 * Seul endroit qui enveloppe les Server Actions de lecture et le nudge de
 * sync en dépendances concrètes de PartyOfflineRepository — l'infra ne
 * connaît que des interfaces, cette usine (présentation, composition root)
 * fait le branchement, comme une Server Action le fait déjà pour
 * PrismaPartyRepository/PrismaAuditLogger.
 */
export function createPartyOfflineRepository(
  tenantId: string,
  userId: string,
): PartyOfflineRepository {
  return new PartyOfflineRepository({
    tenantId,
    userId,
    onMutationEnqueued: () => triggerBackgroundSync(tenantId),
    fetchRemoteById: async (id) => {
      try {
        const { party, balance } = await getPartyByIdAction(id);
        return { ...party, balance };
      } catch {
        return null;
      }
    },
    fetchRemoteList: (filters) => searchPartiesAction(filters),
  });
}

/** Amorce le cache local avec les données fraîchement rendues côté serveur
 * (SSR) — pour qu'une prochaine visite hors ligne les retrouve déjà là. */
export async function seedPartyCache(tenantId: string, parties: PartyWithBalance[]): Promise<void> {
  await Promise.all(
    parties.map((party) =>
      setCachedEntity(tenantId, ENTITY, party.id, party, party.updatedAt.toISOString()),
    ),
  );
}
